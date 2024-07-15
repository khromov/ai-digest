#!/usr/bin/env node

import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import ignore, { Ignore } from 'ignore';

const WHITESPACE_DEPENDENT_EXTENSIONS = [
  '.py',   // Python
  '.yaml', // YAML
  '.yml',  // YAML
  '.jade', // Jade/Pug
  '.haml', // Haml
  '.slim', // Slim
  '.coffee', // CoffeeScript
  '.pug',  // Pug
  '.styl', // Stylus
];

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
  '*.env.*',
  // Our output file
  'codebase.md'
];

function removeWhitespace(val: string): string {
// Remove all whitespace including line breaks, then trim
return val.replace(/\s+/g, ' ').trim();
}

function escapeTripleBackticks(content: string): string {
return content.replace(/```/g, '\\`\\`\\`');
}

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

function createIgnoreFilter(ignorePatterns: string[]): Ignore {
const ig = ignore().add(ignorePatterns);
if (ignorePatterns.length > 0) {
    console.log('Ignore patterns from .aggignore:');
    ignorePatterns.forEach(pattern => {
    console.log(`  - ${pattern}`);
    });
} else {
    console.log('No custom ignore patterns found.');
}
return ig;
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
        
        // Escape triple backticks
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

    // Ensure the directory exists
    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    // Write the file, overwriting if it exists
    await fs.writeFile(outputFile, output, { flag: 'w' });
    
    // Verify the file was written correctly
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