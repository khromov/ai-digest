#!/usr/bin/env node

import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';

async function readIgnoreFile(): Promise<string[]> {
  try {
    const content = await fs.readFile('.aggignore', 'utf-8');
    return content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function aggregateFiles(outputFile: string): Promise<void> {
  try {
    const ignorePatterns = await readIgnoreFile();
    const ig = ignore().add(ignorePatterns);

    const files = await glob('**/*', {
      ignore: ignorePatterns,
      nodir: true,
      dot: true,
    });

    let output = '';

    for (const file of files) {
      if (!ig.ignores(file)) {
        const content = await fs.readFile(file, 'utf-8');
        const extension = path.extname(file).slice(1);  // Remove the leading dot
        
        output += `\`\`\`${extension}\n`;
        output += `// ${file}\n`;
        output += content;
        output += '\n\`\`\`\n\n';
      }
    }

    await fs.writeFile(outputFile, output);
    console.log(`Files aggregated successfully into ${outputFile}`);
  } catch (error) {
    console.error('Error aggregating files:', error);
    process.exit(1);
  }
}

program
  .version('1.0.0')
  .description('Aggregate files into a single Markdown file')
  .option('-o, --output <file>', 'Output file name', 'codebase.md')
  .action(async (options) => {
    await aggregateFiles(options.output);
  });

program.parse(process.argv);
