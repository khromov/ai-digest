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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Simple debounce function to avoid multiple rebuilds when many files change at once
function debounce<F extends (...args: any[]) => any>(
  func: F,
  wait: number
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
  filename: string
): Promise<string[]> {
  try {
    const filePath = path.join(inputDir, filename);
    const content = await fs.readFile(filePath, "utf-8");
    console.log(formatLog(`Found ${filename} file in ${inputDir}.`, "📄"));
    return content
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(formatLog(`No ${filename} file found in ${inputDir}.`, "❓"));
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
  sortBySize: boolean = false
): void {
  console.log(formatLog("Files included in the output:", "📋"));

  const totalSize = Object.values(fileSizes).reduce(
    (sum, size) => sum + size,
    0
  );

  let displayFiles = [...includedFiles];
  if (sortBySize) {
    displayFiles.sort((a, b) => fileSizes[b] - fileSizes[a]);
    console.log(formatLog("Files sorted by size (largest first)", "📊"));
  }

  const maxFileNameLength = Math.min(
    60, // Cap at 60 characters to prevent very long lines
    displayFiles.reduce((max, file) => Math.max(max, file.length), 0)
  );

  displayFiles.forEach((file, index) => {
    const size = fileSizes[file] || 0;
    const percentage = totalSize > 0 ? (size / totalSize) * 100 : 0;
    const barLength = Math.max(1, Math.round(percentage / 2)); // Scale bar length (2% = 1 character), min 1 char
    const bar = "█".repeat(barLength);

    console.log(
      `${(index + 1).toString().padEnd(4)}${file.padEnd(maxFileNameLength + 2)}${formatFileSize(size).padEnd(10)}(${percentage.toFixed(1).padStart(4)}%) ${bar}`
    );
  });
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// Track if a file write is in progress
let isWritingFile = false;

async function watchFiles(
  inputDir: string,
  outputFile: string,
  useDefaultIgnores: boolean,
  removeWhitespaceFlag: boolean,
  showOutputFiles: string | boolean,
  ignoreFile: string,
  testMode: boolean = false
): Promise<void> {
  try {
    // First, run the initial aggregation
    isWritingFile = true;
    await aggregateFiles(
      inputDir,
      outputFile,
      useDefaultIgnores,
      removeWhitespaceFlag,
      showOutputFiles,
      ignoreFile
    );
    isWritingFile = false;

    console.log(
      formatLog("Watch mode enabled. Waiting for file changes...", "👀")
    );

    // Exit early if in test mode to prevent hanging test
    if (testMode) {
      return;
    }

    // Read ignore patterns and setup ignore filters
    const userIgnorePatterns = await readIgnoreFile(inputDir, ignoreFile);
    const defaultIgnore = useDefaultIgnores
      ? ignore().add(DEFAULT_IGNORES)
      : ignore();
    const customIgnore = createIgnoreFilter(userIgnorePatterns, ignoreFile);

    // Function to determine if a file should be ignored
    function shouldIgnorePath(filePath: string): boolean {
      if (!filePath) return true;

      // Skip node_modules and dot directories for performance
      if (filePath.includes("node_modules") || /\/\.[^\/]+\//.test(filePath)) {
        return true;
      }

      // Get relative path for checking ignore patterns
      const relativePath = path.relative(inputDir, filePath);

      // Skip empty relative paths
      if (!relativePath || relativePath === "") {
        return true;
      }

      // Ignore the output file
      if (relativePath === path.relative(inputDir, outputFile)) {
        return true;
      }

      // Check against default ignore patterns
      if (useDefaultIgnores && defaultIgnore.ignores(relativePath)) {
        return true;
      }

      // Check against custom ignore patterns
      if (customIgnore.ignores(relativePath)) {
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
          inputDir,
          outputFile,
          useDefaultIgnores,
          removeWhitespaceFlag,
          showOutputFiles,
          ignoreFile
        );
        isWritingFile = false;
        console.log(
          formatLog("Rebuild complete. Waiting for more changes...", "✅")
        );
      } catch (error) {
        isWritingFile = false;
        console.error(formatLog("Error during rebuild:", "❌"), error);
      }
    }, 500); // Debounce for 500ms

    // Setup watcher WITHOUT using the ignored option
    const watcher = chokidar.watch(inputDir, {
      persistent: true,
      ignoreInitial: true,
      // Only use minimal ignores in watcher configuration
      ignored: ["**/node_modules/**", "**/.*/**"],
    });

    // Log when ready
    watcher.on("ready", () => {
      console.log(formatLog("Initial scan complete. Ready for changes", "✅"));
    });

    // Handle all file events with our custom filtering
    watcher.on("all", (event, filePath) => {
      // Check if file should be ignored using our custom function
      if (!shouldIgnorePath(filePath)) {
        const relativePath = path.relative(inputDir, filePath);
        console.log(formatLog(`${event}: ${relativePath}`, "🔄"));
        debouncedRebuild();
      }
    });

    // Also watch the ignore file itself for changes
    const ignoreFilePath = path.join(inputDir, ignoreFile);
    let ignoreWatcher: chokidar.FSWatcher | null = null;

    try {
      const ignoreFileExists = await fs
        .access(ignoreFilePath)
        .then(() => true)
        .catch(() => false);

      if (ignoreFileExists) {
        // Create a separate watcher just for the ignore file
        ignoreWatcher = chokidar.watch(ignoreFilePath, {
          persistent: true,
          ignoreInitial: true,
        });

        ignoreWatcher.on("change", () => {
          console.log(
            formatLog(
              `${ignoreFile} changed, updating ignore patterns...`,
              "📄"
            )
          );
          debouncedRebuild();
        });
      }
    } catch (error) {
      console.error(formatLog(`Error watching ${ignoreFile}:`, "❌"), error);
    }

    // Handle process termination
    process.on("SIGINT", () => {
      if (isWritingFile) {
        console.log(
          formatLog("Write in progress, waiting to complete...", "⏳")
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
              formatLog("Write complete. Watch mode terminated.", "👋")
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

async function aggregateFiles(
  inputDir: string,
  outputFile: string,
  useDefaultIgnores: boolean,
  removeWhitespaceFlag: boolean,
  showOutputFiles: string | boolean,
  ignoreFile: string
): Promise<void> {
  try {
    const userIgnorePatterns = await readIgnoreFile(inputDir, ignoreFile);
    const defaultIgnore = useDefaultIgnores
      ? ignore().add(DEFAULT_IGNORES)
      : ignore();
    const customIgnore = createIgnoreFilter(userIgnorePatterns, ignoreFile);

    if (useDefaultIgnores) {
      console.log(formatLog("Using default ignore patterns.", "🚫"));
    } else {
      console.log(formatLog("Default ignore patterns disabled.", "✅"));
    }

    if (removeWhitespaceFlag) {
      console.log(
        formatLog(
          "Whitespace removal enabled (except for whitespace-dependent languages).",
          "🧹"
        )
      );
    } else {
      console.log(formatLog("Whitespace removal disabled.", "📝"));
    }

    const allFiles = await glob("**/*", {
      nodir: true,
      dot: true,
      cwd: inputDir,
    });

    console.log(
      formatLog(
        `Found ${allFiles.length} files in ${inputDir}. Applying filters...`,
        "🔍"
      )
    );

    let output = "";
    let includedCount = 0;
    let defaultIgnoredCount = 0;
    let customIgnoredCount = 0;
    let binaryAndSvgFileCount = 0;
    let includedFiles: string[] = [];
    let fileSizes: Record<string, number> = {};

    // Sort the files in natural path order
    const sortedFiles = allFiles.sort(naturalSort);

    for (const file of sortedFiles) {
      const fullPath = path.join(inputDir, file);
      const relativePath = path.relative(inputDir, fullPath);
      if (
        path.relative(inputDir, outputFile) === relativePath ||
        (useDefaultIgnores && defaultIgnore.ignores(relativePath))
      ) {
        defaultIgnoredCount++;
      } else if (customIgnore.ignores(relativePath)) {
        customIgnoredCount++;
      } else {
        // Get file size for stats
        const stats = await fs.stat(fullPath);
        fileSizes[relativePath] = stats.size;

        if ((await isTextFile(fullPath)) && !shouldTreatAsBinary(fullPath)) {
          let content = await fs.readFile(fullPath, "utf-8");
          const extension = path.extname(file);

          content = escapeTripleBackticks(content);

          if (
            removeWhitespaceFlag &&
            !WHITESPACE_DEPENDENT_EXTENSIONS.includes(extension)
          ) {
            content = removeWhitespace(content);
          }

          output += `# ${relativePath}\n\n`;
          output += `\`\`\`${extension.slice(1)}\n`;
          output += content;
          output += "\n\`\`\`\n\n";

          includedCount++;
          includedFiles.push(relativePath);
        } else {
          const fileType = getFileType(fullPath);
          output += `# ${relativePath}\n\n`;
          if (fileType === "SVG Image") {
            output += `This is a file of the type: ${fileType}\n\n`;
          } else {
            output += `This is a binary file of the type: ${fileType}\n\n`;
          }

          binaryAndSvgFileCount++;
          includedCount++;
          includedFiles.push(relativePath);
        }
      }
    }

    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    // Write to a temporary file first to prevent partial writes during SIGINT
    const tempFile = `${outputFile}.temp`;
    await fs.writeFile(tempFile, output, { flag: "w" });

    // Verify the write was successful before moving
    const stats = await fs.stat(tempFile);
    const fileSizeInBytes = stats.size;

    if (stats.size !== Buffer.byteLength(output)) {
      // Clean up and throw error
      await fs.unlink(tempFile).catch(() => {});
      throw new Error("File size mismatch after writing");
    }

    // Atomically rename the temp file to the target file
    // This ensures the file is either fully written or not changed at all
    await fs.rename(tempFile, outputFile);

    console.log(
      formatLog(`Files aggregated successfully into ${outputFile}`, "✅")
    );
    console.log(formatLog(`Total files found: ${allFiles.length}`, "📚"));
    console.log(formatLog(`Files included in output: ${includedCount}`, "📎"));
    if (useDefaultIgnores) {
      console.log(
        formatLog(
          `Files ignored by default patterns: ${defaultIgnoredCount}`,
          "🚫"
        )
      );
    }
    if (customIgnoredCount > 0) {
      console.log(
        formatLog(
          `Files ignored by .aidigestignore: ${customIgnoredCount}`,
          "🚫"
        )
      );
    }
    console.log(
      formatLog(`Binary and SVG files included: ${binaryAndSvgFileCount}`, "📦")
    );

    if (fileSizeInBytes > MAX_FILE_SIZE) {
      console.log(
        formatLog(
          `Warning: Output file size (${(fileSizeInBytes / 1024 / 1024).toFixed(2)} MB) exceeds 10 MB.`,
          "⚠️"
        )
      );
      console.log(
        formatLog(
          "Token count estimation skipped due to large file size.",
          "⚠️"
        )
      );
      console.log(
        formatLog(
          "Consider adding more files to .aidigestignore to reduce the output size.",
          "💡"
        )
      );
    } else {
      const { gptTokens, claudeTokens } = estimateTokenCount(output);
      console.log(formatLog(`Estimated token counts - Claude models: ${claudeTokens} tokens, GPT-4: ${gptTokens} tokens`, "🔢"));
    }

    if (showOutputFiles) {
      // Check if we should sort by size
      const sortBySize = showOutputFiles === "sort";
      displayIncludedFiles(includedFiles, fileSizes, sortBySize);
    }

    console.log(formatLog(`Done! Wrote code base to ${outputFile}`, "✅"));
  } catch (error) {
    console.error(formatLog("Error aggregating files:", "❌"), error);
    process.exit(1);
  }
}

// Read package.json to get the version
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, "utf-8"));

program
  .version(packageJson.version)
  .description("Aggregate files into a single Markdown file")
  .option("-i, --input <directory>", "Input directory", process.cwd())
  .option("-o, --output <file>", "Output file name", "codebase.md")
  .option("--no-default-ignores", "Disable default ignore patterns")
  .option("--whitespace-removal", "Enable whitespace removal")
  .option(
    "--show-output-files [sort]",
    "Display a list of files included in the output, optionally sorted by size ('sort')"
  )
  .option("--ignore-file <file>", "Custom ignore file name", ".aidigestignore")
  .option("--watch", "Watch for file changes and rebuild automatically")
  .action(async (options) => {
    const inputDir = path.resolve(options.input);
    const outputFile = path.isAbsolute(options.output)
      ? options.output
      : path.join(process.cwd(), options.output);

    if (options.watch) {
      // Run in watch mode
      await watchFiles(
        inputDir,
        outputFile,
        options.defaultIgnores,
        options.whitespaceRemoval,
        options.showOutputFiles,
        options.ignoreFile,
        process.env.NODE_ENV === "test" // Pass test mode flag based on environment
      );
    } else {
      // Run once
      await aggregateFiles(
        inputDir,
        outputFile,
        options.defaultIgnores,
        options.whitespaceRemoval,
        options.showOutputFiles,
        options.ignoreFile
      );
    }
  });

program.parse(process.argv);