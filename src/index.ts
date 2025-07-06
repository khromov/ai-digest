#!/usr/bin/env node

import { program } from "commander";
import { promises as fs } from "fs";
import * as fsSync from "fs";
import path from "path";
import { glob } from "glob";
import ignore from "ignore";
import * as chokidar from "chokidar";
import {
  WHITESPACE_DEPENDENT_EXTENSIONS,
  DEFAULT_IGNORES,
  removeWhitespace,
  escapeTripleBackticks,
  createIgnoreFilter,
  estimateTokenCount,
  formatLog,
  isTextFile,
  getFileType,
  shouldTreatAsBinary,
} from "./utils";

// Define the type for the ignore instance
type IgnoreInstance = ReturnType<typeof ignore>;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

function getActualWorkingDirectory() {
  // INIT_CWD is set by npm/npx to the directory from which the command was invoked
  // This is more reliable than process.cwd() when running via npx
  if (process.env.INIT_CWD) {
    return process.env.INIT_CWD;
  }

  return process.cwd();
}

// Simple debounce function to avoid multiple rebuilds when many files change at once
function debounce<F extends (...args: any[]) => any>(
  func: F,
  wait: number,
): (...args: Parameters<F>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<F>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

async function readIgnoreFile(
  inputDir: string,
  filename: string,
  silent: boolean = false,
): Promise<string[]> {
  try {
    const filePath = path.join(inputDir, filename);
    const content = await fs.readFile(filePath, "utf-8");
    if (!silent) {
      console.log(formatLog(`Found ${filename} file in ${inputDir}.`, "📄"));
    }
    return content
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (!silent) {
        console.log(
          formatLog(`No ${filename} file found in ${inputDir}.`, "❓"),
        );
      }
      return [];
    }
    throw error;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayIncludedFiles(
  includedFiles: string[],
  fileSizes: Record<string, number>,
  sortBySize: boolean = false,
): void {
  console.log(formatLog("Files included in the output:", "📋"));

  const totalSize = Object.values(fileSizes).reduce(
    (sum, size) => sum + size,
    0,
  );

  let displayFiles = [...includedFiles];
  if (sortBySize) {
    displayFiles.sort((a, b) => fileSizes[b] - fileSizes[a]);
    console.log(formatLog("Files sorted by size (largest first)", "📊"));
  }

  const maxFileNameLength = Math.min(
    60, // Cap at 60 characters to prevent very long lines
    displayFiles.reduce((max, file) => Math.max(max, file.length), 0),
  );

  displayFiles.forEach((file, index) => {
    const size = fileSizes[file] || 0;
    const percentage = totalSize > 0 ? (size / totalSize) * 100 : 0;
    const barLength = Math.max(1, Math.round(percentage / 2)); // Scale bar length (2% = 1 character), min 1 char
    const bar = "█".repeat(barLength);

    console.log(
      `${(index + 1).toString().padEnd(4)}${file.padEnd(maxFileNameLength + 2)}${formatFileSize(size).padEnd(10)}(${percentage.toFixed(1).padStart(4)}%) ${bar}`,
    );
  });
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// Track if a file write is in progress
let isWritingFile = false;

// Type definitions for processed files
export type ProcessedFile = {
  fileName: string;
  content: string;
};

// Core function to process files and return them as an array
export async function processFiles(options: {
  inputDirs?: string[];
  inputDir?: string;
  outputFilePath?: string | null;
  useDefaultIgnores?: boolean;
  removeWhitespaceFlag?: boolean;
  ignoreFile?: string;
  silent?: boolean;
}): Promise<{
  files: ProcessedFile[];
  stats: {
    totalFiles: number;
    includedCount: number;
    defaultIgnoredCount: number;
    customIgnoredCount: number;
    binaryAndSvgFileCount: number;
    includedFiles: string[];
    fileSizeInBytes: number;
  };
}> {
  const {
    inputDirs,
    inputDir,
    outputFilePath = null,
    useDefaultIgnores = true,
    removeWhitespaceFlag = false,
    ignoreFile = ".aidigestignore",
    silent = false,
  } = options;

  // Support both single inputDir and multiple inputDirs
  const directories = inputDirs || (inputDir ? [inputDir] : [process.cwd()]);

  try {
    // Object to store ignore patterns for each input directory
    const allIgnorePatterns: Record<string, string[]> = {};

    for (const dir of directories) {
      allIgnorePatterns[dir] = await readIgnoreFile(dir, ignoreFile, silent);
    }

    const defaultIgnore = useDefaultIgnores
      ? ignore().add(DEFAULT_IGNORES)
      : ignore();

    // Create custom ignore filter for each directory
    const customIgnores: Record<string, IgnoreInstance> = {};
    for (const dir of directories) {
      customIgnores[dir] = createIgnoreFilter(
        allIgnorePatterns[dir],
        ignoreFile,
        silent,
      );
    }

    if (!silent) {
      if (useDefaultIgnores) {
        console.log(formatLog("Using default ignore patterns.", "🚫"));
      } else {
        console.log(formatLog("Default ignore patterns disabled.", "✅"));
      }

      if (removeWhitespaceFlag) {
        console.log(
          formatLog(
            "Whitespace removal enabled (except for whitespace-dependent languages).",
            "🧹",
          ),
        );
      } else {
        console.log(formatLog("Whitespace removal disabled.", "📝"));
      }
    }

    // Store all file paths and their content
    type FileEntry = {
      relativePath: string;
      fullPath: string;
      sourceDir: string;
    };

    let allFileEntries: FileEntry[] = [];

    // Collect files from all input directories
    for (const inputDir of directories) {
      if (!silent) {
        console.log(formatLog(`Scanning directory: ${inputDir}`, "🔍"));
      }

      const dirFiles = await glob("**/*", {
        nodir: true,
        dot: true,
        cwd: inputDir,
      });

      if (!silent) {
        console.log(
          formatLog(`Found ${dirFiles.length} files in ${inputDir}`, "🔍"),
        );
      }

      for (const file of dirFiles) {
        const fullPath = path.join(inputDir, file);
        allFileEntries.push({
          relativePath: file,
          fullPath,
          sourceDir: inputDir,
        });
      }
    }

    if (directories.length > 1 && !silent) {
      console.log(
        formatLog(
          `Total files found across all directories: ${allFileEntries.length}`,
          "🔍",
        ),
      );
    }

    let includedCount = 0;
    let defaultIgnoredCount = 0;
    let customIgnoredCount = 0;
    let binaryAndSvgFileCount = 0;
    let includedFiles: string[] = [];
    let fileSizes: Record<string, number> = {};
    let processedFiles: ProcessedFile[] = [];

    // Sort the files in natural path order
    allFileEntries.sort((a, b) => naturalSort(a.relativePath, b.relativePath));

    for (const entry of allFileEntries) {
      const { relativePath, fullPath, sourceDir } = entry;

      // Generate a unique path for display that includes the source directory
      // But only add the source directory name when there are multiple directories
      const displayPath =
        directories.length > 1
          ? `${path.basename(sourceDir)}/${relativePath}`
          : relativePath;

      const outputAbsPath = outputFilePath
        ? path.isAbsolute(outputFilePath)
          ? outputFilePath
          : path.join(getActualWorkingDirectory(), outputFilePath)
        : null;

      if (
        (outputAbsPath && fullPath === outputAbsPath) ||
        (useDefaultIgnores && defaultIgnore.ignores(relativePath))
      ) {
        defaultIgnoredCount++;
      } else if (customIgnores[sourceDir].ignores(relativePath)) {
        customIgnoredCount++;
      } else {
        // Get file size for stats
        const stats = await fs.stat(fullPath);
        fileSizes[displayPath] = stats.size;

        let fileContent = "";

        if ((await isTextFile(fullPath)) && !shouldTreatAsBinary(fullPath)) {
          let content = await fs.readFile(fullPath, "utf-8");
          const extension = path.extname(relativePath);

          content = escapeTripleBackticks(content);

          if (
            removeWhitespaceFlag &&
            !WHITESPACE_DEPENDENT_EXTENSIONS.includes(extension)
          ) {
            content = removeWhitespace(content);
          }

          fileContent = `# ${displayPath}\n\n`;
          fileContent += `\`\`\`${extension.slice(1) || ""}\n`;
          fileContent += content;
          fileContent += "\n\`\`\`\n\n";

          includedCount++;
          includedFiles.push(displayPath);
        } else {
          const fileType = getFileType(fullPath);
          fileContent = `# ${displayPath}\n\n`;
          if (fileType === "SVG Image") {
            fileContent += `This is a file of the type: ${fileType}\n\n`;
          } else {
            fileContent += `This is a binary file of the type: ${fileType}\n\n`;
          }

          binaryAndSvgFileCount++;
          includedCount++;
          includedFiles.push(displayPath);
        }

        processedFiles.push({
          fileName: displayPath,
          content: fileContent,
        });
      }
    }

    const totalContentSize = processedFiles.reduce(
      (sum, file) => sum + Buffer.byteLength(file.content),
      0,
    );

    return {
      files: processedFiles,
      stats: {
        totalFiles: allFileEntries.length,
        includedCount,
        defaultIgnoredCount,
        customIgnoredCount,
        binaryAndSvgFileCount,
        includedFiles,
        fileSizeInBytes: totalContentSize,
      },
    };
  } catch (error) {
    if (!silent) {
      console.error(formatLog("Error processing files:", "❌"), error);
    }
    throw error;
  }
}

// Core function to generate the digest content
export async function generateDigestContent(options: {
  inputDirs?: string[];
  inputDir?: string;
  outputFilePath?: string | null;
  useDefaultIgnores?: boolean;
  removeWhitespaceFlag?: boolean;
  ignoreFile?: string;
  silent?: boolean;
}): Promise<{
  content: string;
  files: ProcessedFile[];
  stats: {
    totalFiles: number;
    includedCount: number;
    defaultIgnoredCount: number;
    customIgnoredCount: number;
    binaryAndSvgFileCount: number;
    includedFiles: string[];
    estimatedTokens: number;
    fileSizeInBytes: number;
  };
}> {
  try {
    // Use the new processFiles function
    const { files, stats } = await processFiles(options);

    // Concatenate all files into a single output string
    const output = files.map((file) => file.content).join("");

    const fileSizeInBytes = Buffer.byteLength(output);
    let estimatedTokens = 0;

    if (fileSizeInBytes <= MAX_FILE_SIZE) {
      const tokenCounts = estimateTokenCount(output);
      // Use GPT tokens as the default for backward compatibility
      if (typeof tokenCounts === "object" && tokenCounts.gptTokens) {
        estimatedTokens = tokenCounts.gptTokens;
      } else if (typeof tokenCounts === "number") {
        estimatedTokens = tokenCounts;
      }
    }

    return {
      content: output,
      files,
      stats: {
        ...stats,
        estimatedTokens,
        fileSizeInBytes,
      },
    };
  } catch (error) {
    if (!options.silent) {
      console.error(formatLog("Error generating digest content:", "❌"), error);
    }
    throw error;
  }
}

// Function to write digest to file and display stats
export async function writeDigestToFile(
  content: string,
  outputFile: string,
  stats: {
    totalFiles: number;
    includedCount: number;
    defaultIgnoredCount: number;
    customIgnoredCount: number;
    binaryAndSvgFileCount: number;
    includedFiles: string[];
    estimatedTokens: number;
    fileSizeInBytes: number;
  },
  showOutputFiles: string | boolean = false,
  fileSizes?: Record<string, number>,
): Promise<void> {
  try {
    const outputPath = path.isAbsolute(outputFile)
      ? outputFile
      : path.join(getActualWorkingDirectory(), outputFile);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Write to a temporary file first to prevent partial writes during SIGINT
    const tempFile = `${outputPath}.temp`;
    await fs.writeFile(tempFile, content, { flag: "w" });

    // Verify the write was successful before moving
    const tempStats = await fs.stat(tempFile);

    if (tempStats.size !== Buffer.byteLength(content)) {
      // Clean up and throw error
      await fs.unlink(tempFile).catch(() => {});
      throw new Error("File size mismatch after writing");
    }

    // Atomically rename the temp file to the target file
    // This ensures the file is either fully written or not changed at all
    await fs.rename(tempFile, outputPath);

    console.log(
      formatLog(`Files aggregated successfully into ${outputFile}`, "✅"),
    );
    console.log(formatLog(`Total files found: ${stats.totalFiles}`, "📚"));
    console.log(
      formatLog(`Files included in output: ${stats.includedCount}`, "📎"),
    );

    if (stats.defaultIgnoredCount > 0) {
      console.log(
        formatLog(
          `Files ignored by default patterns: ${stats.defaultIgnoredCount}`,
          "🚫",
        ),
      );
    }

    if (stats.customIgnoredCount > 0) {
      console.log(
        formatLog(
          `Files ignored by .aidigestignore: ${stats.customIgnoredCount}`,
          "🚫",
        ),
      );
    }

    console.log(
      formatLog(
        `Binary and SVG files included: ${stats.binaryAndSvgFileCount}`,
        "📦",
      ),
    );

    if (stats.fileSizeInBytes > MAX_FILE_SIZE) {
      console.log(
        formatLog(
          `Warning: Output file size (${(stats.fileSizeInBytes / 1024 / 1024).toFixed(2)} MB) exceeds 10 MB.`,
          "⚠️",
        ),
      );
      console.log(
        formatLog(
          "Token count estimation skipped due to large file size.",
          "⚠️",
        ),
      );
      console.log(
        formatLog(
          "Consider adding more files to .aidigestignore to reduce the output size.",
          "💡",
        ),
      );
    } else {
      const tokenCounts = estimateTokenCount(content);
      if (
        typeof tokenCounts === "object" &&
        tokenCounts.gptTokens &&
        tokenCounts.claudeTokens
      ) {
        console.log(
          formatLog(
            `Estimated token counts - Claude models: ${tokenCounts.claudeTokens} tokens, GPT-4: ${tokenCounts.gptTokens} tokens`,
            "🔢",
          ),
        );
      } else {
        console.log(
          formatLog(`Estimated token count: ${stats.estimatedTokens}`, "🔢"),
        );
        console.log(
          formatLog(
            "Note: Token count is an approximation using GPT-4 tokenizer. For ChatGPT, it should be accurate. For Claude, it may be ±20% approximately.",
            "⚠️",
          ),
        );
      }
    }

    if (showOutputFiles) {
      // Check if we should sort by size
      const sortBySize = showOutputFiles === "sort";
      displayIncludedFiles(stats.includedFiles, fileSizes || {}, sortBySize);
    }

    console.log(formatLog(`Done! Wrote code base to ${outputFile}`, "✅"));
  } catch (error) {
    console.error(formatLog("Error writing digest to file:", "❌"), error);
    throw error;
  }
}

// Watch mode function
async function watchFiles(
  inputDirs: string[],
  outputFile: string,
  useDefaultIgnores: boolean,
  removeWhitespaceFlag: boolean,
  showOutputFiles: string | boolean,
  ignoreFile: string,
  testMode: boolean = false,
): Promise<void> {
  try {
    // First, run the initial aggregation
    isWritingFile = true;
    await aggregateFiles(
      inputDirs,
      outputFile,
      useDefaultIgnores,
      removeWhitespaceFlag,
      showOutputFiles,
      ignoreFile,
    );
    isWritingFile = false;

    console.log(
      formatLog("Watch mode enabled. Waiting for file changes...", "👀"),
    );

    // Exit early if in test mode to prevent hanging test
    if (testMode) {
      return;
    }

    // Read ignore patterns for each input directory
    const allIgnorePatterns: Record<string, string[]> = {};
    for (const inputDir of inputDirs) {
      allIgnorePatterns[inputDir] = await readIgnoreFile(
        inputDir,
        ignoreFile,
        true,
      );
    }

    const defaultIgnore = useDefaultIgnores
      ? ignore().add(DEFAULT_IGNORES)
      : ignore();

    // Create custom ignore filter for each directory
    const customIgnores: Record<string, IgnoreInstance> = {};
    for (const inputDir of inputDirs) {
      customIgnores[inputDir] = createIgnoreFilter(
        allIgnorePatterns[inputDir],
        ignoreFile,
        true,
      );
    }

    // Function to determine if a file should be ignored
    function shouldIgnorePath(filePath: string): boolean {
      if (!filePath) return true;

      // Skip node_modules and dot directories for performance
      if (filePath.includes("node_modules") || /\/\.[^\/]+\//.test(filePath)) {
        return true;
      }

      // Find the corresponding input directory for this file
      let matchingInputDir = "";
      for (const inputDir of inputDirs) {
        if (filePath.startsWith(inputDir)) {
          matchingInputDir = inputDir;
          break;
        }
      }

      if (!matchingInputDir) return true;

      // Get relative path for checking ignore patterns
      const relativePath = path.relative(matchingInputDir, filePath);

      // Skip empty relative paths
      if (!relativePath || relativePath === "") {
        return true;
      }

      // Ignore the output file
      const outputAbsPath = path.isAbsolute(outputFile)
        ? outputFile
        : path.join(getActualWorkingDirectory(), outputFile);
      if (filePath === outputAbsPath) {
        return true;
      }

      // Check against default ignore patterns
      if (useDefaultIgnores && defaultIgnore.ignores(relativePath)) {
        return true;
      }

      // Check against custom ignore patterns for this directory
      if (customIgnores[matchingInputDir].ignores(relativePath)) {
        return true;
      }

      return false;
    }

    // Create a debounced rebuild function
    const debouncedRebuild = debounce(async () => {
      try {
        console.log(formatLog("Changes detected, rebuilding...", "🔄"));
        isWritingFile = true;
        await aggregateFiles(
          inputDirs,
          outputFile,
          useDefaultIgnores,
          removeWhitespaceFlag,
          showOutputFiles,
          ignoreFile,
        );
        isWritingFile = false;
        console.log(
          formatLog("Rebuild complete. Waiting for more changes...", "✅"),
        );
      } catch (error) {
        isWritingFile = false;
        console.error(formatLog("Error during rebuild:", "❌"), error);
      }
    }, 500); // Debounce for 500ms

    // Setup watchers for each input directory
    const watchers: chokidar.FSWatcher[] = [];

    for (const inputDir of inputDirs) {
      const watcher = chokidar.watch(inputDir, {
        persistent: true,
        ignoreInitial: true,
        // Only use minimal ignores in watcher configuration
        ignored: ["**/node_modules/**", "**/.*/**"],
      });

      // Log when ready
      watcher.on("ready", () => {
        console.log(formatLog(`Initial scan of ${inputDir} complete.`, "✅"));
      });

      // Handle all file events with our custom filtering
      watcher.on("all", (event, filePath) => {
        // Check if file should be ignored using our custom function
        if (!shouldIgnorePath(filePath)) {
          const relativePath = path.relative(inputDir, filePath);
          console.log(
            formatLog(`${event}: ${relativePath} in ${inputDir}`, "🔄"),
          );
          debouncedRebuild();
        }
      });

      watchers.push(watcher);
    }

    // Also watch the ignore files themselves for changes
    const ignoreWatchers: chokidar.FSWatcher[] = [];

    for (const inputDir of inputDirs) {
      const ignoreFilePath = path.join(inputDir, ignoreFile);

      try {
        const ignoreFileExists = await fs
          .access(ignoreFilePath)
          .then(() => true)
          .catch(() => false);

        if (ignoreFileExists) {
          // Create a separate watcher just for the ignore file
          const ignoreWatcher = chokidar.watch(ignoreFilePath, {
            persistent: true,
            ignoreInitial: true,
          });

          ignoreWatcher.on("change", () => {
            console.log(
              formatLog(
                `${ignoreFile} in ${inputDir} changed, updating ignore patterns...`,
                "📄",
              ),
            );
            debouncedRebuild();
          });

          ignoreWatchers.push(ignoreWatcher);
        }
      } catch (error) {
        console.error(
          formatLog(`Error watching ${ignoreFile} in ${inputDir}:`, "❌"),
          error,
        );
      }
    }

    // Handle process termination
    process.on("SIGINT", () => {
      if (isWritingFile) {
        console.log(
          formatLog("Write in progress, waiting to complete...", "⏳"),
        );

        // Set up a maximum wait time of 2 seconds
        const forceExitTimeout = setTimeout(() => {
          console.log(formatLog("Timeout reached, forcing exit.", "⚠️"));
          process.exit(0);
        }, 2000);

        // Poll to check when writing is complete
        const checkInterval = setInterval(() => {
          if (!isWritingFile) {
            clearTimeout(forceExitTimeout);
            clearInterval(checkInterval);
            console.log(
              formatLog("Write complete. Watch mode terminated.", "👋"),
            );
            process.exit(0);
          }
        }, 100);
      } else {
        console.log(formatLog("Watch mode terminated.", "👋"));
        process.exit(0);
      }
    });

    // Keep the process alive
    return new Promise(() => {});
  } catch (error) {
    console.error(formatLog("Error in watch mode:", "❌"), error);
    process.exit(1);
  }
}

// CLI aggregateFiles function (supports multiple directories)
async function aggregateFiles(
  inputDirs: string[],
  outputFile: string,
  useDefaultIgnores: boolean,
  removeWhitespaceFlag: boolean,
  showOutputFiles: string | boolean,
  ignoreFile: string,
): Promise<void> {
  try {
    const { content, files, stats } = await generateDigestContent({
      inputDirs,
      outputFilePath: outputFile,
      useDefaultIgnores,
      removeWhitespaceFlag,
      ignoreFile,
      silent: false,
    });

    // Create file sizes mapping from processed content sizes
    const fileSizes: Record<string, number> = {};
    files.forEach((file) => {
      fileSizes[file.fileName] = Buffer.byteLength(file.content);
    });

    await writeDigestToFile(
      content,
      outputFile,
      stats,
      showOutputFiles,
      fileSizes,
    );
  } catch (error) {
    console.error(formatLog("Error aggregating files:", "❌"), error);
    process.exit(1);
  }
}

// Main library function
export async function generateDigest(
  options: {
    inputDir?: string;
    inputDirs?: string[];
    outputFile?: string | null;
    useDefaultIgnores?: boolean;
    removeWhitespaceFlag?: boolean;
    ignoreFile?: string;
    showOutputFiles?: boolean | string;
    silent?: boolean;
  } = {},
): Promise<string | void> {
  const {
    inputDir,
    inputDirs,
    outputFile = "codebase.md",
    useDefaultIgnores = true,
    removeWhitespaceFlag = false,
    ignoreFile = ".aidigestignore",
    showOutputFiles = false,
    silent = false,
  } = options;

  // Support both single inputDir and multiple inputDirs
  const directories =
    inputDirs ||
    (inputDir ? [path.resolve(inputDir)] : [getActualWorkingDirectory()]);

  const resolvedOutputFile =
    outputFile === null
      ? null
      : path.isAbsolute(outputFile)
        ? outputFile
        : path.join(getActualWorkingDirectory(), outputFile);

  // Generate digest content
  const { content, stats } = await generateDigestContent({
    inputDirs: directories,
    outputFilePath: resolvedOutputFile,
    useDefaultIgnores,
    removeWhitespaceFlag,
    ignoreFile,
    silent,
  });

  // If outputFile is null, return the content as string
  if (resolvedOutputFile === null) {
    return content;
  }

  // Otherwise write to file
  await writeDigestToFile(content, resolvedOutputFile, stats, showOutputFiles);
}

// New function to generate digest and return array of file objects
export async function generateDigestFiles(
  options: {
    inputDir?: string;
    inputDirs?: string[];
    outputFile?: string | null;
    useDefaultIgnores?: boolean;
    removeWhitespaceFlag?: boolean;
    ignoreFile?: string;
    silent?: boolean;
  } = {},
): Promise<{ files: ProcessedFile[] }> {
  const {
    inputDir,
    inputDirs,
    outputFile = null,
    useDefaultIgnores = true,
    removeWhitespaceFlag = false,
    ignoreFile = ".aidigestignore",
    silent = false,
  } = options;

  // Support both single inputDir and multiple inputDirs
  const directories =
    inputDirs ||
    (inputDir ? [path.resolve(inputDir)] : [getActualWorkingDirectory()]);

  const resolvedOutputFile =
    outputFile === null
      ? null
      : path.isAbsolute(outputFile)
        ? outputFile
        : path.join(getActualWorkingDirectory(), outputFile);

  // Process files and return the array format
  const { files } = await processFiles({
    inputDirs: directories,
    outputFilePath: resolvedOutputFile,
    useDefaultIgnores,
    removeWhitespaceFlag,
    ignoreFile,
    silent,
  });

  return { files };
}

// CLI functionality
if (require.main === module) {
  // Read package.json to get the version
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, "utf-8"));

  program
    .version(packageJson.version)
    .description("Aggregate files into a single Markdown file")
    .option(
      "-i, --input <directories...>",
      "Input directories (multiple allowed)",
      [getActualWorkingDirectory()],
    )
    .option("-o, --output <file>", "Output file name", "codebase.md")
    .option("--no-default-ignores", "Disable default ignore patterns")
    .option("--whitespace-removal", "Enable whitespace removal")
    .option(
      "--show-output-files [sort]",
      "Display a list of files included in the output, optionally sorted by size ('sort')",
    )
    .option(
      "--ignore-file <file>",
      "Custom ignore file name",
      ".aidigestignore",
    )
    .option("--watch", "Watch for file changes and rebuild automatically")
    .action(async (options) => {
      const inputDirs = options.input.map((dir: string) => path.resolve(dir));
      const outputFile = path.isAbsolute(options.output)
        ? options.output
        : path.join(getActualWorkingDirectory(), options.output);

      if (options.watch) {
        // Run in watch mode
        await watchFiles(
          inputDirs,
          outputFile,
          options.defaultIgnores,
          options.whitespaceRemoval,
          options.showOutputFiles,
          options.ignoreFile,
          process.env.NODE_ENV === "test", // Pass test mode flag based on environment
        );
      } else {
        // Run once
        await aggregateFiles(
          inputDirs,
          outputFile,
          options.defaultIgnores,
          options.whitespaceRemoval,
          options.showOutputFiles,
          options.ignoreFile,
        );
      }
    });

  program.parse(process.argv);
}

// New function to get file statistics
export async function getFileStats(
  options: {
    inputDir?: string;
    inputDirs?: string[];
    outputFile?: string | null;
    useDefaultIgnores?: boolean;
    ignoreFile?: string;
    silent?: boolean;
  } = {},
): Promise<{
  files: Array<{
    path: string;
    sizeInBytes: number;
  }>;
  totalGptTokens: number;
  totalClaudeTokens: number;
}> {
  const {
    inputDir,
    inputDirs,
    outputFile = null,
    useDefaultIgnores = true,
    ignoreFile = ".aidigestignore",
    silent = true,
  } = options;

  // Support both single inputDir and multiple inputDirs
  const directories =
    inputDirs ||
    (inputDir ? [path.resolve(inputDir)] : [getActualWorkingDirectory()]);

  const resolvedOutputFile =
    outputFile === null
      ? null
      : path.isAbsolute(outputFile)
        ? outputFile
        : path.join(getActualWorkingDirectory(), outputFile);

  // Process files to get the content
  const { files } = await processFiles({
    inputDirs: directories,
    outputFilePath: resolvedOutputFile,
    useDefaultIgnores,
    removeWhitespaceFlag: false,
    ignoreFile,
    silent,
  });

  // Calculate token counts and build result array
  let totalGptTokens = 0;
  let totalClaudeTokens = 0;

  const fileStats = files.map((file) => {
    const tokenCounts = estimateTokenCount(file.content);
    const gptTokens =
      typeof tokenCounts === "object" && tokenCounts.gptTokens
        ? tokenCounts.gptTokens
        : typeof tokenCounts === "number"
          ? tokenCounts
          : 0;
    const claudeTokens =
      typeof tokenCounts === "object" && tokenCounts.claudeTokens
        ? tokenCounts.claudeTokens
        : 0;

    // Add to totals
    totalGptTokens += gptTokens;
    totalClaudeTokens += claudeTokens;

    return {
      path: file.fileName,
      sizeInBytes: Buffer.byteLength(file.content),
    };
  });

  // Sort by size (largest first)
  fileStats.sort((a, b) => b.sizeInBytes - a.sizeInBytes);

  return {
    files: fileStats,
    totalGptTokens,
    totalClaudeTokens,
  };
}

// Default export for library usage
export default {
  generateDigest,
  generateDigestFiles,
  generateDigestContent,
  writeDigestToFile,
  processFiles,
  getFileStats,
};
