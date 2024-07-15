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
  createIgnoreFilter
} from './utils';

async function readIgnoreFile(filename: string = '.aggignore'): Promise<string[]> {
  try {
    const content = await fs.readFile(filename, 'utf-8');
    console.log(`Found ${filename} file.`);
    return content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`No ${filename} file found.`);
      return [];
    }
    throw error;
  }
}

async function aggregateFiles(outputFile: string, useDefaultIgnores: boolean, removeWhitespaceFlag: boolean): Promise<void> {
  try {
    const userIgnorePatterns = await readIgnoreFile();
    const defaultIgnore = useDefaultIgnores ? ignore().add(DEFAULT_IGNORES) : ignore();
    const customIgnore = createIgnoreFilter(userIgnorePatterns);

    if (useDefaultIgnores) {
      console.log('Using default ignore patterns.');
    } else {
      console.log('Default ignore patterns disabled.');
    }

    if (removeWhitespaceFlag) {
      console.log('Whitespace removal enabled (except for whitespace-dependent languages).');
    }

    const allFiles = await glob('**/*', {
      nodir: true,
      dot: true,
    });

    console.log(`Found ${allFiles.length} files. Applying filters...`);

    let output = '';
    let includedCount = 0;
    let defaultIgnoredCount = 0;
    let customIgnoredCount = 0;

    for (const file of allFiles) {
      if (file === outputFile || (useDefaultIgnores && defaultIgnore.ignores(file))) {
        defaultIgnoredCount++;
      } else if (customIgnore.ignores(file)) {
        customIgnoredCount++;
      } else {
        let content = await fs.readFile(file, 'utf-8');
        const extension = path.extname(file);
        
        content = escapeTripleBackticks(content);
        
        if (removeWhitespaceFlag && !WHITESPACE_DEPENDENT_EXTENSIONS.includes(extension)) {
          content = removeWhitespace(content);
        }
        
        output += `# ${file}\n\n`;
        output += `\`\`\`${extension.slice(1)}\n`;
        output += content;
        output += '\n\`\`\`\n\n';

        includedCount++;
      }
    }

    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, output, { flag: 'w' });
    
    const stats = await fs.stat(outputFile);
    console.log(`Output file size: ${stats.size} bytes`);
    
    if (stats.size !== Buffer.byteLength(output)) {
      throw new Error('File size mismatch after writing');
    }

    console.log(`Files aggregated successfully into ${outputFile}`);
    console.log(`Total files found: ${allFiles.length}`);
    console.log(`Files included in output: ${includedCount}`);
    if (useDefaultIgnores) {
      console.log(`Files ignored by default patterns: ${defaultIgnoredCount}`);
    }
    if (customIgnoredCount > 0) {
      console.log(`Files ignored by .aggignore: ${customIgnoredCount}`);
    }
  } catch (error) {
    console.error('Error aggregating files:', error);
    process.exit(1);
  }
}

program
  .version('1.0.0')
  .description('Aggregate files into a single Markdown file')
  .option('-o, --output <file>', 'Output file name', 'codebase.md')
  .option('--no-default-ignores', 'Disable default ignore patterns')
  .option('--no-whitespace-removal', 'Disable whitespace removal')
  .action(async (options) => {
    await aggregateFiles(options.output, options.defaultIgnores, options.whitespaceRemoval);
  });

program.parse(process.argv);