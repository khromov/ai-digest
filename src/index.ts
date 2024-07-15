#!/usr/bin/env node

import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import ignore, { Ignore } from 'ignore';

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

async function readIgnoreFile(filename: string = '.aggignore'): Promise<string[]> {
  try {
    const content = await fs.readFile(filename, 'utf-8');
    console.log(`Found ${filename} file.`);
    return content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`No ${filename} file found. Using default ignores.`);
      return [];
    }
    throw error;
  }
}

function createIgnoreFilter(ignorePatterns: string[]): Ignore {
  const ig = ignore().add(DEFAULT_IGNORES);
  if (ignorePatterns.length > 0) {
    console.log('Additional ignore patterns:');
    ignorePatterns.forEach(pattern => {
      console.log(`  - ${pattern}`);
      ig.add(pattern);
    });
  }
  return ig;
}

async function aggregateFiles(outputFile: string): Promise<void> {
  try {
    const userIgnorePatterns = await readIgnoreFile();
    const ig = createIgnoreFilter(userIgnorePatterns);

    const files = await glob('**/*', {
      ignore: [...DEFAULT_IGNORES, ...userIgnorePatterns],
      nodir: true,
      dot: true,
    });

    console.log(`Found ${files.length} files. Applying filters...`);

    let output = '';
    let includedCount = 0;
    let ignoredCount = 0;

    for (const file of files) {
      if (!ig.ignores(file)) {
        const content = await fs.readFile(file, 'utf-8');
        const extension = path.extname(file).slice(1);  // Remove the leading dot
        
        output += `# ${file}\n\n`;
        output += `\`\`\`${extension}\n`;
        output += content;
        output += '\n\`\`\`\n\n';

        includedCount++;
      } else {
        ignoredCount++;
      }
    }

    await fs.writeFile(outputFile, output);
    console.log(`Files aggregated successfully into ${outputFile}`);
    console.log(`Included ${includedCount} files out of ${files.length} total files.`);
    console.log(`Ignored ${ignoredCount} files.`);
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