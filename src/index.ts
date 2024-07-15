#!/usr/bin/env node

import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';

const DEFAULT_IGNORES = [
  // Node.js
  'node_modules',
  'package-lock.json',
  'npm-debug.log',
  // Yarn
  'yarn.lock',
  'yarn-error.log',
  // pnpm
  'pnpm-lock.yaml',
  // Bun
  'bun.lockb',
  // Deno
  'deno.lock',
  // PHP (Composer)
  'vendor',
  'composer.lock',
  // Python
  '__pycache__',
  '*.pyc',
  '*.pyo',
  '*.pyd',
  '.Python',
  'pip-log.txt',
  'pip-delete-this-directory.txt',
  '.venv',
  'venv',
  'ENV',
  'env',
  // Ruby
  'Gemfile.lock',
  '.bundle',
  // Java
  'target',
  '*.class',
  // Gradle
  '.gradle',
  'build',
  // Maven
  'pom.xml.tag',
  'pom.xml.releaseBackup',
  'pom.xml.versionsBackup',
  'pom.xml.next',
  // .NET
  'bin',
  'obj',
  '*.suo',
  '*.user',
  // Go
  'go.sum',
  // Rust
  'Cargo.lock',
  'target',
  // General
  '.git',
  '.svn',
  '.hg',
  '.DS_Store',
  'Thumbs.db'
];

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
    const userIgnorePatterns = await readIgnoreFile();
    const allIgnorePatterns = [...DEFAULT_IGNORES, ...userIgnorePatterns];
    const ig = ignore().add(allIgnorePatterns);

    const files = await glob('**/*', {
      ignore: allIgnorePatterns,
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