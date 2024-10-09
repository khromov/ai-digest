#!/usr/bin/env node

import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
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
  shouldTreatAsBinary
} from './utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

async function readIgnoreFile(inputDir: string, filename: string): Promise<string[]> {
  try {
    const filePath = path.join(inputDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(formatLog(`Found ${filename} file in ${inputDir}.`, '📄'));
    return content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(formatLog(`No ${filename} file found in ${inputDir}.`, '❓'));
      return [];
    }
    throw error;
  }
}

function displayIncludedFiles(includedFiles: string[]): void {
  console.log(formatLog('Files included in the output:', '📋'));
  includedFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function aggregateFiles(inputDir: string, outputFile: string, useDefaultIgnores: boolean, removeWhitespaceFlag: boolean, showOutputFiles: boolean, ignoreFile: string): Promise<void> {
  try {
    const userIgnorePatterns = await readIgnoreFile(inputDir, ignoreFile);
    const defaultIgnore = useDefaultIgnores ? ignore().add(DEFAULT_IGNORES) : ignore();
    const customIgnore = createIgnoreFilter(userIgnorePatterns, ignoreFile);

    if (useDefaultIgnores) {
      console.log(formatLog('Using default ignore patterns.', '🚫'));
    } else {
      console.log(formatLog('Default ignore patterns disabled.', '✅'));
    }

    if (removeWhitespaceFlag) {
      console.log(formatLog('Whitespace removal enabled (except for whitespace-dependent languages).', '🧹'));
    } else {
      console.log(formatLog('Whitespace removal disabled.', '📝'));
    }

    const allFiles = await glob('**/*', {
      nodir: true,
      dot: true,
      cwd: inputDir,
    });

    console.log(formatLog(`Found ${allFiles.length} files in ${inputDir}. Applying filters...`, '🔍'));

    let output = '';
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
      if (path.relative(inputDir, outputFile) === relativePath || (useDefaultIgnores && defaultIgnore.ignores(relativePath))) {
        defaultIgnoredCount++;
      } else if (customIgnore.ignores(relativePath)) {
        customIgnoredCount++;
      } else {
        if (await isTextFile(fullPath) && !shouldTreatAsBinary(fullPath)) {
          let content = await fs.readFile(fullPath, 'utf-8');
          const extension = path.extname(file);
          
          content = escapeTripleBackticks(content);
          
          if (removeWhitespaceFlag && !WHITESPACE_DEPENDENT_EXTENSIONS.includes(extension)) {
            content = removeWhitespace(content);
          }
          
          output += `# ${relativePath}\n\n`;
          output += `\`\`\`${extension.slice(1)}\n`;
          output += content;
          output += '\n\`\`\`\n\n';

          includedCount++;
          includedFiles.push(relativePath);
        } else {
          const fileType = getFileType(fullPath);
          output += `# ${relativePath}\n\n`;
          if (fileType === 'SVG Image') {
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
    await fs.writeFile(outputFile, output, { flag: 'w' });
    
    const stats = await fs.stat(outputFile);
    const fileSizeInBytes = stats.size;
    
    if (stats.size !== Buffer.byteLength(output)) {
      throw new Error('File size mismatch after writing');
    }

    console.log(formatLog(`Files aggregated successfully into ${outputFile}`, '✅'));
    console.log(formatLog(`Total files found: ${allFiles.length}`, '📚'));
    console.log(formatLog(`Files included in output: ${includedCount}`, '📎'));
    if (useDefaultIgnores) {
      console.log(formatLog(`Files ignored by default patterns: ${defaultIgnoredCount}`, '🚫'));
    }
    if (customIgnoredCount > 0) {
      console.log(formatLog(`Files ignored by .aidigestignore: ${customIgnoredCount}`, '🚫'));
    }
    console.log(formatLog(`Binary and SVG files included: ${binaryAndSvgFileCount}`, '📦'));

    if (fileSizeInBytes > MAX_FILE_SIZE) {
      console.log(formatLog(`Warning: Output file size (${(fileSizeInBytes / 1024 / 1024).toFixed(2)} MB) exceeds 10 MB.`, '⚠️'));
      console.log(formatLog('Token count estimation skipped due to large file size.', '⚠️'));
      console.log(formatLog('Consider adding more files to .aidigestignore to reduce the output size.', '💡'));
    } else {
      const tokenCount = estimateTokenCount(output);
      console.log(formatLog(`Estimated token count: ${tokenCount}`, '🔢'));
      console.log(formatLog('Note: Token count is an approximation using GPT-4 tokenizer. For ChatGPT, it should be accurate. For Claude, it may be ±20% approximately.', '⚠️'));
    }

    if (showOutputFiles) {
      displayIncludedFiles(includedFiles);
    }

    console.log(formatLog(`Done! Wrote code base to ${outputFile}`, '✅'));
  } catch (error) {
    console.error(formatLog('Error aggregating files:', '❌'), error);
    process.exit(1);
  }
}

program
  .version('1.0.0')
  .description('Aggregate files into a single Markdown file')
  .option('-i, --input <directory>', 'Input directory', process.cwd())
  .option('-o, --output <file>', 'Output file name', 'codebase.md')
  .option('--no-default-ignores', 'Disable default ignore patterns')
  .option('--whitespace-removal', 'Enable whitespace removal')
  .option('--show-output-files', 'Display a list of files included in the output')
  .option('--ignore-file <file>', 'Custom ignore file name', '.aidigestignore')
  .action(async (options) => {
    const inputDir = path.resolve(options.input);
    const outputFile = path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output);
    await aggregateFiles(inputDir, outputFile, options.defaultIgnores, options.whitespaceRemoval, options.showOutputFiles, options.ignoreFile);
  });

program.parse(process.argv);