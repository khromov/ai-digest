#!/usr/bin/env node

import { program } from "commander";
import { promises as fs } from "fs";
import * as fsSync from "fs";
import path from "path";
import { glob } from "glob";
import ignore from "ignore";
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

async function readIgnoreFile(
  inputDir: string,
  filename: string,
  silent: boolean = false
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
          formatLog(`No ${filename} file found in ${inputDir}.`, "❓")
        );
      }
      return [];
    }
    throw error;
  }
}

function displayIncludedFiles(includedFiles: string[]): void {
  console.log(formatLog("Files included in the output:", "📋"));
  includedFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// Core function to generate the digest content
export async function generateDigestContent(options: {
  inputDir: string;
  outputFilePath?: string | null;
  useDefaultIgnores?: boolean;
  removeWhitespaceFlag?: boolean;
  ignoreFile?: string;
  silent?: boolean;
}): Promise<{
  content: string;
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
  const {
    inputDir,
    outputFilePath = null,
    useDefaultIgnores = true,
    removeWhitespaceFlag = false,
    ignoreFile = ".aidigestignore",
    silent = false,
  } = options;

  try {
    const userIgnorePatterns = await readIgnoreFile(
      inputDir,
      ignoreFile,
      silent
    );
    const defaultIgnore = useDefaultIgnores
      ? ignore().add(DEFAULT_IGNORES)
      : ignore();
    const customIgnore = createIgnoreFilter(
      userIgnorePatterns,
      ignoreFile,
      silent
    );

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
            "🧹"
          )
        );
      } else {
        console.log(formatLog("Whitespace removal disabled.", "📝"));
      }
    }

    const allFiles = await glob("**/*", {
      nodir: true,
      dot: true,
      cwd: inputDir,
    });

    if (!silent) {
      console.log(
        formatLog(
          `Found ${allFiles.length} files in ${inputDir}. Applying filters...`,
          "🔍"
        )
      );
    }

    let output = "";
    let includedCount = 0;
    let defaultIgnoredCount = 0;
    let customIgnoredCount = 0;
    let binaryAndSvgFileCount = 0;
    let includedFiles: string[] = [];

    // Sort the files in natural path order
    const sortedFiles = allFiles.sort(naturalSort);

    for (const file of sortedFiles) {
      const fullPath = path.join(inputDir, file);
      const relativePath = path.relative(inputDir, fullPath);

      // Skip the output file if it's specified
      if (
        (outputFilePath &&
          path.relative(inputDir, outputFilePath) === relativePath) ||
        (useDefaultIgnores && defaultIgnore.ignores(relativePath))
      ) {
        defaultIgnoredCount++;
      } else if (customIgnore.ignores(relativePath)) {
        customIgnoredCount++;
      } else {
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

    const fileSizeInBytes = Buffer.byteLength(output);
    let estimatedTokens = 0;

    if (fileSizeInBytes <= MAX_FILE_SIZE) {
      estimatedTokens = estimateTokenCount(output);
    }

    return {
      content: output,
      stats: {
        totalFiles: allFiles.length,
        includedCount,
        defaultIgnoredCount,
        customIgnoredCount,
        binaryAndSvgFileCount,
        includedFiles,
        estimatedTokens,
        fileSizeInBytes,
      },
    };
  } catch (error) {
    console.error(
      !silent ? formatLog("Error generating digest content:", "❌") : "",
      error
    );
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
  showOutputFiles: boolean = false
): Promise<void> {
  try {
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, content, { flag: "w" });

    console.log(
      formatLog(`Files aggregated successfully into ${outputFile}`, "✅")
    );
    console.log(formatLog(`Total files found: ${stats.totalFiles}`, "📚"));
    console.log(
      formatLog(`Files included in output: ${stats.includedCount}`, "📎")
    );

    if (stats.defaultIgnoredCount > 0) {
      console.log(
        formatLog(
          `Files ignored by default patterns: ${stats.defaultIgnoredCount}`,
          "🚫"
        )
      );
    }

    if (stats.customIgnoredCount > 0) {
      console.log(
        formatLog(
          `Files ignored by .aidigestignore: ${stats.customIgnoredCount}`,
          "🚫"
        )
      );
    }

    console.log(
      formatLog(
        `Binary and SVG files included: ${stats.binaryAndSvgFileCount}`,
        "📦"
      )
    );

    if (stats.fileSizeInBytes > MAX_FILE_SIZE) {
      console.log(
        formatLog(
          `Warning: Output file size (${(stats.fileSizeInBytes / 1024 / 1024).toFixed(2)} MB) exceeds 10 MB.`,
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
      console.log(
        formatLog(`Estimated token count: ${stats.estimatedTokens}`, "🔢")
      );
      console.log(
        formatLog(
          "Note: Token count is an approximation using GPT-4 tokenizer. For ChatGPT, it should be accurate. For Claude, it may be ±20% approximately.",
          "⚠️"
        )
      );
    }

    if (showOutputFiles) {
      displayIncludedFiles(stats.includedFiles);
    }

    console.log(formatLog(`Done! Wrote code base to ${outputFile}`, "✅"));
  } catch (error) {
    console.error(formatLog("Error writing digest to file:", "❌"), error);
    throw error;
  }
}

// Original function (maintaining backward compatibility for CLI)
async function aggregateFiles(
  inputDir: string,
  outputFile: string,
  useDefaultIgnores: boolean,
  removeWhitespaceFlag: boolean,
  showOutputFiles: boolean,
  ignoreFile: string
): Promise<void> {
  try {
    const { content, stats } = await generateDigestContent({
      inputDir,
      outputFilePath: outputFile,
      useDefaultIgnores,
      removeWhitespaceFlag,
      ignoreFile,
      silent: false,
    });

    await writeDigestToFile(content, outputFile, stats, showOutputFiles);
  } catch (error) {
    console.error(formatLog("Error aggregating files:", "❌"), error);
    process.exit(1);
  }
}

// Main library function
export async function generateDigest(
  options: {
    inputDir?: string;
    outputFile?: string | null;
    useDefaultIgnores?: boolean;
    removeWhitespaceFlag?: boolean;
    ignoreFile?: string;
    showOutputFiles?: boolean;
    silent?: boolean;
  } = {}
): Promise<string | void> {
  const {
    inputDir = process.cwd(),
    outputFile = "codebase.md",
    useDefaultIgnores = true,
    removeWhitespaceFlag = false,
    ignoreFile = ".aidigestignore",
    showOutputFiles = false,
    silent = false,
  } = options;

  const resolvedInputDir = path.resolve(inputDir);
  const resolvedOutputFile =
    outputFile === null
      ? null
      : path.isAbsolute(outputFile)
        ? outputFile
        : path.join(process.cwd(), outputFile);

  // Generate digest content
  const { content, stats } = await generateDigestContent({
    inputDir: resolvedInputDir,
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

// CLI functionality
if (require.main === module) {
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
      "--show-output-files",
      "Display a list of files included in the output"
    )
    .option(
      "--ignore-file <file>",
      "Custom ignore file name",
      ".aidigestignore"
    )
    .action(async (options) => {
      const inputDir = path.resolve(options.input);
      const outputFile = path.isAbsolute(options.output)
        ? options.output
        : path.join(process.cwd(), options.output);
      await aggregateFiles(
        inputDir,
        outputFile,
        options.defaultIgnores,
        options.whitespaceRemoval,
        options.showOutputFiles,
        options.ignoreFile
      );
    });

  program.parse(process.argv);
}

// Default export for library usage
export default {
  generateDigest,
  generateDigestContent,
  writeDigestToFile,
};
