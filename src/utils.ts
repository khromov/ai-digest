import { Ignore } from 'ignore';
import { encodingForModel } from 'js-tiktoken';

export const WHITESPACE_DEPENDENT_EXTENSIONS = [
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

export const DEFAULT_IGNORES = [
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

export function removeWhitespace(val: string): string {
  return val.replace(/\s+/g, ' ').trim();
}

export function escapeTripleBackticks(content: string): string {
  return content.replace(/```/g, '\\`\\`\\`');
}

export function createIgnoreFilter(ignorePatterns: string[]): Ignore {
  const ig = require('ignore')().add(ignorePatterns);
  if (ignorePatterns.length > 0) {
    console.log('Ignore patterns from .aidigestignore:');
    ignorePatterns.forEach(pattern => {
      console.log(`  - ${pattern}`);
    });
  } else {
    console.log('No custom ignore patterns found.');
  }
  return ig;
}

export function estimateTokenCount(text: string): number {
    const enc = encodingForModel('gpt-4o');
    const tokens = enc.encode(text);
    return tokens.length;
  }
  
  export function formatLog(message: string, emoji: string = ''): string {
    return `${emoji ? emoji + ' ' : ''}${message}`;
  }