#!/usr/bin/env node

import { program } from "commander";
import * as fsSync from "fs";
import path from "path";
import { getActualWorkingDirectory } from "./utils";
import {
  processFiles,
  generateDigestContent,
  writeDigestToFile,
  watchFiles,
  aggregateFiles,
  getFileStats,
} from "./digest";
import { MinifyFileDescriptionCallback, ProcessedFile } from "./types";

// Main library function
export async function generateDigest(
  options: {
    inputDir?: string;
    inputDirs?: string[];
    outputFile?: string | null;
    useDefaultIgnores?: boolean;
    removeWhitespaceFlag?: boolean;
    ignoreFile?: string;
    minifyFile?: string;
    minifyFileDescription?: MinifyFileDescriptionCallback;
    showOutputFiles?: boolean | string;
    silent?: boolean;
    additionalDefaultIgnores?: string[];
  } = {},
): Promise<string | void> {
  const {
    inputDir,
    inputDirs,
    outputFile = "codebase.md",
    useDefaultIgnores = true,
    removeWhitespaceFlag = false,
    ignoreFile = ".aidigestignore",
    minifyFile = ".aidigestminify",
    minifyFileDescription,
    showOutputFiles = false,
    silent = false,
    additionalDefaultIgnores = [],
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
    minifyFile,
    minifyFileDescription,
    silent,
    additionalDefaultIgnores,
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
    minifyFile?: string;
    minifyFileDescription?: MinifyFileDescriptionCallback;
    silent?: boolean;
    additionalDefaultIgnores?: string[];
  } = {},
): Promise<{ files: ProcessedFile[] }> {
  const {
    inputDir,
    inputDirs,
    outputFile = null,
    useDefaultIgnores = true,
    removeWhitespaceFlag = false,
    ignoreFile = ".aidigestignore",
    minifyFile = ".aidigestminify",
    minifyFileDescription,
    silent = false,
    additionalDefaultIgnores = [],
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
    minifyFile,
    minifyFileDescription,
    silent,
    additionalDefaultIgnores,
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
    .option(
      "--minify-file <file>",
      "Custom minify file name",
      ".aidigestminify",
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
          options.minifyFile,
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
          options.minifyFile,
        );
      }
    });

  program.parse(process.argv);
}

// Export all the public API functions
export {
  generateDigestContent,
  writeDigestToFile,
  processFiles,
  getFileStats,
} from "./digest";

// Export types
export type { MinifyFileDescriptionCallback, ProcessedFile } from "./types";

// Default export for library usage
export default {
  generateDigest,
  generateDigestFiles,
  generateDigestContent,
  writeDigestToFile,
  processFiles,
  getFileStats,
};
