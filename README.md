# ai-digest

A CLI tool to aggregate your codebase into a single Markdown file for use with Claude Projects or custom ChatGPTs.

## How to Use

Start by running the CLI tool in your project directory:

```bash
npx ai-digest
```

This will generate a `codebase.md` file with your codebase.

Once you've generated the Markdown file containing your codebase, you can use it with AI models like ChatGPT and Claude for code analysis and assistance.

## Features

- Aggregates all files in the specified directory and subdirectories
- Ignores common build artifacts and configuration files
- Outputs a single Markdown file containing the whole codebase
- Provides options for whitespace removal and custom ignore patterns
- View file size statistics with visual bar charts
- Watch mode for automatic rebuilding when files change
- Minify file support for including files with placeholder content
- Customizable minified file descriptions via callback function (library mode)

### With ChatGPT:

1. Create a Custom GPT
2. Upload the generated Markdown file to the GPT's knowledge base

### With Claude:

1. Create a new Project
2. Add the Markdown file to the Project's knowledge

For best results, re-upload the Markdown file before starting a new chat session to ensure the AI has the most up-to-date version of your codebase.

## Options

- `-i, --input <directories...>`: Specify input directories (multiple allowed, default: current directory)
- `-o, --output <file>`: Specify output file (default: codebase.md)
- `--no-default-ignores`: Disable default ignore patterns
- `--whitespace-removal`: Enable whitespace removal
- `--show-output-files [sort]`: Display a list of files with size statistics and bar charts. Add `sort` to sort by file size.
- `--ignore-file <file>`: Specify a custom ignore file (default: .aidigestignore)
- `--minify-file <file>`: Specify a custom minify file (default: .aidigestminify)
- `--watch`: Enable watch mode to automatically rebuild when files change
- `--help`: Show help

## Examples

### CLI Examples

1. Basic usage:

   ```bash
   npx ai-digest
   ```

2. Specify input and output:

   ```bash
   npx ai-digest -i /path/to/your/project -o project_summary.md
   ```

3. Enable whitespace removal:

   ```bash
   npx ai-digest --whitespace-removal
   ```

4. Show files included with size statistics:

   ```bash
   npx ai-digest --show-output-files
   ```

5. Show files sorted by size (largest first):

   ```bash
   npx ai-digest --show-output-files sort
   ```

6. Watch mode:

   ```bash
   npx ai-digest --watch
   ```

7. Use custom minify file:

   ```bash
   npx ai-digest --minify-file .myminifypatterns
   ```

8. Combine multiple options:

   ```bash
   npx ai-digest -i /path/to/your/project -o project_summary.md --whitespace-removal --show-output-files sort --watch
   ```

### Library Usage

ai-digest can also be used as a library in your Node.js projects:

```bash
npm install ai-digest
```

#### Basic Usage

```javascript
import aiDigest from 'ai-digest';

// Generate digest content as a string
const content = await aiDigest.generateDigest({
  inputDir: './src',
  outputFile: null,  // Return as string instead of writing to file
  silent: true       // Suppress console output
});

// Or save directly to a file
await aiDigest.generateDigest({
  inputDir: './src',
  outputFile: 'codebase.md',
  removeWhitespaceFlag: true,
  showOutputFiles: 'sort'
});
```

#### Using Minify Patterns

```javascript
import aiDigest from 'ai-digest';

// Use minify patterns to exclude content from specific files
const content = await aiDigest.generateDigest({
  inputDir: './src',
  outputFile: null,
  minifyFile: '.aidigestminify',  // Default value
  silent: true
});

// Or use a custom minify file location
const content = await aiDigest.generateDigest({
  inputDir: './src',
  outputFile: null,
  minifyFile: 'config/.myminifypatterns',
  silent: true
});

// Get detailed content with statistics including minified file count
const { content, files, stats } = await aiDigest.generateDigestContent({
  inputDir: './src',
  minifyFile: '.aidigestminify',
  silent: true
});

console.log(`Total files: ${stats.totalFiles}`);
console.log(`Minified files: ${stats.minifiedCount}`);
console.log(`Included files: ${stats.includedCount}`);
```

#### Customizing Minified File Descriptions

When using ai-digest as a library, you can customize how minified files are represented in the output by providing a `minifyFileDescription` callback function:

```javascript
import aiDigest, { MinifyFileDescriptionCallback } from 'ai-digest';

// Define a custom callback to format minified file descriptions
const customMinifyDescription: MinifyFileDescriptionCallback = (metadata) => {
  // metadata contains:
  // - filePath: full path to the file
  // - displayPath: relative path shown in output
  // - extension: file extension (e.g., 'js', 'css')
  // - fileType: detected file type
  // - defaultText: the default placeholder text
  
  // Return custom formatted text
  return `# ${metadata.displayPath}\n\n` +
    `⚠️ Minified ${metadata.extension.toUpperCase()} file\n` +
    `Size reduced for AI context optimization.\n\n`;
};

// Use the callback with any library function
const content = await aiDigest.generateDigest({
  inputDir: './src',
  outputFile: null,
  minifyFile: '.aidigestminify',
  minifyFileDescription: customMinifyDescription,
  silent: true
});

// Works with all library functions that support minify
const { files } = await aiDigest.generateDigestFiles({
  inputDir: './src',
  minifyFile: '.aidigestminify',
  minifyFileDescription: customMinifyDescription,
  silent: true
});
```

##### Advanced Example: Different Descriptions by File Type

```javascript
const typeBasedDescription: MinifyFileDescriptionCallback = (metadata) => {
  switch (metadata.extension) {
    case 'js':
      return `# ${metadata.displayPath}\n\n📦 JavaScript bundle (minified)\n\n`;
    case 'css':
      return `# ${metadata.displayPath}\n\n🎨 Stylesheet bundle (minified)\n\n`;
    case 'json':
      return `# ${metadata.displayPath}\n\n📊 Data file (content excluded)\n\n`;
    default:
      // Fall back to default text for unknown types
      return metadata.defaultText;
  }
};

const content = await aiDigest.generateDigest({
  inputDir: './dist',
  outputFile: null,
  minifyFile: '.aidigestminify',
  minifyFileDescription: typeBasedDescription,
  silent: true
});
```

##### Extending the Default Description

```javascript
// Add extra information while keeping the default format
const extendedDescription: MinifyFileDescriptionCallback = (metadata) => {
  return metadata.defaultText + 
    `Note: Original file at ${metadata.filePath}\n` +
    `Consider reviewing the source files instead.\n`;
};
```

#### Working with Individual Files

```javascript
import aiDigest from 'ai-digest';

// Get individual file objects for custom filtering
const { files } = await aiDigest.generateDigestFiles({
  inputDir: './src',
  minifyFile: '.aidigestminify',  // Respects minify patterns
  silent: true
});

// Each file has: { fileName: string, content: string }
// Minified files will have placeholder content
files.forEach(file => {
  if (file.content.includes('(File exists but content excluded via .aidigestminify)')) {
    console.log(`${file.fileName} was minified`);
  }
});

// Apply custom filtering after processing
const jsFiles = files.filter(file => file.fileName.endsWith('.js'));
const customDigest = jsFiles.map(file => file.content).join('');
```

#### File Statistics

```javascript
import aiDigest from 'ai-digest';

// Get file statistics without content (useful for analysis)
const stats = await aiDigest.getFileStats({
  inputDir: './src',
  minifyFile: '.aidigestminify',  // Minified files show reduced size
  silent: true
});

// Returns files sorted by size (largest first) with total token counts
console.log(stats);
// {
//   files: [
//     { path: 'large-file.js', sizeInBytes: 15420 },
//     { path: 'minified.min.js', sizeInBytes: 108 },  // Shows placeholder size
//     { path: 'small-file.txt', sizeInBytes: 1024 }
//   ],
//   totalGptTokens: 5850,
//   totalClaudeTokens: 6284
// }
```

#### Advanced Options

```javascript
import aiDigest from 'ai-digest';

// All available options for library functions
const options = {
  inputDir: './src',                    // Single input directory
  inputDirs: ['./src', './lib'],        // Multiple input directories (alternative to inputDir)
  outputFile: 'output.md',               // Output file path (null for string return)
  useDefaultIgnores: true,               // Use default ignore patterns
  removeWhitespaceFlag: false,           // Remove unnecessary whitespace
  ignoreFile: '.aidigestignore',         // Custom ignore file name
  minifyFile: '.aidigestminify',         // Custom minify file name
  minifyFileDescription: callback,       // Custom minify description callback (optional)
  showOutputFiles: false,                // Show file list (false, true, or 'sort')
  silent: true,                          // Suppress console output
  additionalDefaultIgnores: ['*.test.js'] // Additional patterns to ignore
};

// Use with any function
const content = await aiDigest.generateDigest(options);
const { files } = await aiDigest.generateDigestFiles(options);
const { content: fullContent, files: allFiles, stats } = await aiDigest.generateDigestContent(options);
const fileStats = await aiDigest.getFileStats(options);
```

### Available Functions

- `generateDigest(options)` - Main function for generating digests
- `generateDigestFiles(options)` - Generate digest and return array of individual file objects
- `generateDigestContent(options)` - Lower-level function that returns content, files, and stats
- `writeDigestToFile(content, outputFile, stats, showOutputFiles, fileSizes)` - Write digest content to a file
- `getFileStats(options)` - Get file statistics (path, size) sorted by size with total token counts, without content

### Function Return Types

```typescript
// Type for minify file description callback
type MinifyFileDescriptionCallback = (metadata: {
  filePath: string;       // Full path to the file
  displayPath: string;    // Relative path shown in output
  extension: string;      // File extension (without dot)
  fileType: string;       // Detected file type
  defaultText: string;    // Default placeholder text
}) => string;

// generateDigest returns:
string | void  // String when outputFile is null, void when writing to file

// generateDigestFiles returns:
{
  files: Array<{
    fileName: string;
    content: string;  // Full content or minified placeholder
  }>
}

// generateDigestContent returns:
{
  content: string;
  files: Array<{ fileName: string; content: string; }>;
  stats: {
    totalFiles: number;
    includedCount: number;
    defaultIgnoredCount: number;
    customIgnoredCount: number;
    minifiedCount: number;
    binaryAndSvgFileCount: number;
    includedFiles: string[];
    estimatedTokens: number;
    fileSizeInBytes: number;
  }
}

// getFileStats returns:
{
  files: Array<{
    path: string;
    sizeInBytes: number;
  }>;
  totalGptTokens: number;
  totalClaudeTokens: number;
}
```

## Custom Ignore Patterns

ai-digest supports custom ignore patterns using a `.aidigestignore` file in the root directory of your project. This file works similarly to `.gitignore`, allowing you to specify files and directories that should be excluded from the aggregation.

Use the `--show-output-files` flag to see which files are being included, making it easier to identify candidates for exclusion.

## Custom Minify Patterns

ai-digest supports custom minify patterns using a `.aidigestminify` file in the root directory of your project. This file works similarly to `.aidigestignore`, but instead of excluding files completely, it includes them with a placeholder message indicating the file exists but its content is not included in the codebase dump. This is useful for large generated files, compiled assets, or files that don't need their full content in the AI context.

Example `.aidigestminify` file:
```
# Minified JavaScript files
*.min.js
*.min.css

# Large generated files
dist/*
build/*

# Database files
*.db
*.sqlite

# Large data files
*.csv
*.json
```

When a file matches a minify pattern, it will appear in the output like this:
```
# dist/bundle.min.js

This is a minified file of type: JS
(File exists but content excluded via .aidigestminify)
```

In library mode, you can customize these placeholder descriptions using the `minifyFileDescription` callback option (see Library Usage section above).

## Whitespace Removal

When using the `--whitespace-removal` flag, ai-digest removes excess whitespace from files to reduce the token count when used with AI models. This feature is disabled for whitespace-dependent languages like Python and YAML.

## Binary and SVG File Handling

Binary files and SVGs are included in the output with a note about their file type. This allows AI models to be aware of these files without including their full content.

## Watch Mode

When using the `--watch` flag, ai-digest will continuously monitor your files for changes and automatically regenerate the output file whenever a relevant file is modified, added, or deleted. This is especially useful during development when you're making frequent changes to your codebase.

The watch mode:

- Respects all ignore patterns (both default and custom)
- Respects minify patterns from `.aidigestminify`
- Rebuilds only when non-ignored files change
- Includes a debounce mechanism to avoid multiple rebuilds when many files change at once
- Can be terminated with Ctrl+C

## Local Development

Run `npm run start` to run the CLI tool on the local project. (Very meta!)

Run `npm test` to run the tests.

To pass flags to the CLI, use the `--` flag, like this: `npm run start -- --whitespace-removal`.

## Deploy New Version

```
npm publish
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
