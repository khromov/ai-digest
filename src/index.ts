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
  'Thumbs.db',
  // Environment variables
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
  '*.env',
  '*.env.*'
];

async function readIgnoreFile(filename: string = '.aggignore'): Promise<string[]> {
  try {
    const content = await fs.readFile(filename, 'utf-8');
    console.log(`Found ${filename} file.`);
    return content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`No ${filename} file found. Using default ignores only.`);
      return [];
    }
    throw error;
  }
}

function createIgnoreFilter(ignorePatterns: string[]): Ignore {
  const ig = ignore().add(ignorePatterns);
  if (ignorePatterns.length > 0) {
    console.log('Ignore patterns from .aggignore:');
    ignorePatterns.forEach(pattern => {
      console.log(`  - ${pattern}`);
    });
  }
  return ig;
}

async function aggregateFiles(outputFile: string, useDefaultIgnores: boolean): Promise<void> {
  try {
    const userIgnorePatterns = await readIgnoreFile();
    const defaultIgnore = useDefaultIgnores ? ignore().add(DEFAULT_IGNORES) : ignore();
    const customIgnore = createIgnoreFilter(userIgnorePatterns);

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
      if (useDefaultIgnores && defaultIgnore.ignores(file)) {
        defaultIgnoredCount++;
      } else if (customIgnore.ignores(file)) {
        customIgnoredCount++;
      } else {
        const content = await fs.readFile(file, 'utf-8');
        const extension = path.extname(file).slice(1);  // Remove the leading dot
        
        output += `# ${file}\n\n`;
        output += `\`\`\`${extension}\n`;
        output += content;
        output += '\n\`\`\`\n\n';

        includedCount++;
      }
    }

    await fs.writeFile(outputFile, output);
    console.log(`Files aggregated successfully into ${outputFile}`);
    console.log(`Total files found: ${allFiles.length}`);
    console.log(`Files included in output: ${includedCount}`);
    if (useDefaultIgnores) {
      console.log(`Files ignored by default patterns: ${defaultIgnoredCount}`);
    }
    console.log(`Files ignored by .aggignore: ${customIgnoredCount}`);
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
  .action(async (options) => {
    await aggregateFiles(options.output, options.defaultIgnores);
  });

program.parse(process.argv);