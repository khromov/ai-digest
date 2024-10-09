import { Ignore } from "ignore";
import { isBinaryFile } from "isbinaryfile";
import { encodingForModel } from "js-tiktoken";
import path from 'path';

export const WHITESPACE_DEPENDENT_EXTENSIONS = [
  ".py", // Python
  ".yaml", // YAML
  ".yml", // YAML
  ".jade", // Jade/Pug
  ".haml", // Haml
  ".slim", // Slim
  ".coffee", // CoffeeScript
  ".pug", // Pug
  ".styl", // Stylus
  ".gd", // Godot
];

export const DEFAULT_IGNORES = [
  // Node.js
  "node_modules",
  "package-lock.json",
  "npm-debug.log",
  // Yarn
  "yarn.lock",
  "yarn-error.log",
  // pnpm
  "pnpm-lock.yaml",
  // Bun
  "bun.lockb",
  // Deno
  "deno.lock",
  // PHP (Composer)
  "vendor",
  "composer.lock",
  // Python
  "__pycache__",
  "*.pyc",
  "*.pyo",
  "*.pyd",
  ".Python",
  "pip-log.txt",
  "pip-delete-this-directory.txt",
  ".venv",
  "venv",
  "ENV",
  "env",
  // Godot
  ".godot",
  "*.import",
  // Ruby
  "Gemfile.lock",
  ".bundle",
  // Java
  "target",
  "*.class",
  // Gradle
  ".gradle",
  "build",
  // Maven
  "pom.xml.tag",
  "pom.xml.releaseBackup",
  "pom.xml.versionsBackup",
  "pom.xml.next",
  // .NET
  "bin",
  "obj",
  "*.suo",
  "*.user",
  // Go
  "go.sum",
  // Rust
  "Cargo.lock",
  "target",
  // General
  ".git",
  ".svn",
  ".hg",
  ".DS_Store",
  "Thumbs.db",
  // Environment variables
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.test.local",
  ".env.production.local",
  "*.env",
  "*.env.*",
  // Common framework directories
  ".svelte-kit",
  ".next",
  ".nuxt",
  ".vuepress",
  ".cache",
  "dist",
  "tmp",
  // Our output file
  "codebase.md",
  // Turborepo cache folder
  ".turbo"
];

export function removeWhitespace(val: string): string {
  return val.replace(/\s+/g, " ").trim();
}

export function escapeTripleBackticks(content: string): string {
  return content.replace(/\`\`\`/g, "\\`\\`\\`");
}

export function createIgnoreFilter(ignorePatterns: string[], ignoreFile: string): Ignore {
  const ig = require("ignore")().add(ignorePatterns);
  if (ignorePatterns.length > 0) {
    console.log(`Ignore patterns from ${ignoreFile}:`);
    ignorePatterns.forEach((pattern) => {
      console.log(`  - ${pattern}`);
    });
  } else {
    console.log("No custom ignore patterns found.");
  }
  return ig;
}

export function estimateTokenCount(text: string): number {
  try {
    const enc = encodingForModel("gpt-4o");
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

export function formatLog(message: string, emoji: string = ""): string {
  return `${emoji ? emoji + " " : ""}${message}`;
}

export async function isTextFile(filePath: string): Promise<boolean> {
  try {
    const isBinary = await isBinaryFile(filePath);
    return !isBinary && !filePath.toLowerCase().endsWith('.svg');
  } catch (error) {
    console.error(`Error checking if file is binary: ${filePath}`, error);
    return false;
  }
}

export function getFileType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.gif':
    case '.bmp':
    case '.webp':
      return 'Image';
    case '.svg':
      return 'SVG Image';
    case '.wasm':
      return 'WebAssembly';
    case '.pdf':
      return 'PDF';
    case '.doc':
    case '.docx':
      return 'Word Document';
    case '.xls':
    case '.xlsx':
      return 'Excel Spreadsheet';
    case '.ppt':
    case '.pptx':
      return 'PowerPoint Presentation';
    case '.zip':
    case '.rar':
    case '.7z':
      return 'Compressed Archive';
    case '.exe':
      return 'Executable';
    case '.dll':
      return 'Dynamic-link Library';
    case '.so':
      return 'Shared Object';
    case '.dylib':
      return 'Dynamic Library';
    default:
      return 'Binary';
  }
}

export function shouldTreatAsBinary(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.svg') || getFileType(filePath) !== 'Binary';
}
