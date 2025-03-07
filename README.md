# ai-digest

A CLI tool to aggregate your codebase into a single Markdown file for use with Claude Projects or custom ChatGPTs.

## Features

- Aggregates all files in the specified directory and subdirectories
- Ignores common build artifacts and configuration files
- Outputs a single Markdown file containing the whole codebase
- Provides options for whitespace removal and custom ignore patterns
- Can be used programmatically as a library in Node.js projects

## How to Use

Start by running the CLI tool in your project directory:

```bash
npx ai-digest
```

This will generate a `codebase.md` file with your codebase.

Once you've generated the Markdown file containing your codebase, you can use it with AI models like ChatGPT and Claude for code analysis and assistance.

### With ChatGPT:

1. Create a Custom GPT
2. Upload the generated Markdown file to the GPT's knowledge base

### With Claude:

1. Create a new Project
2. Add the Markdown file to the Project's knowledge

For best results, re-upload the Markdown file before starting a new chat session to ensure the AI has the most up-to-date version of your codebase.

## Options

### CLI Options

- `-i, --input <directory>`: Specify input directory (default: current directory)
- `-o, --output <file>`: Specify output file (default: codebase.md)
- `--no-default-ignores`: Disable default ignore patterns
- `--whitespace-removal`: Enable whitespace removal
- `--show-output-files`: Display a list of files included in the output
- `--ignore-file <file>`: Specify a custom ignore file (default: .aidigestignore)
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

4. Show list of included files:

   ```bash
   npx ai-digest --show-output-files
   ```

5. Combine multiple options:

   ```bash
   npx ai-digest -i /path/to/your/project -o project_summary.md --whitespace-removal --show-output-files
   ```

## Custom Ignore Patterns

ai-digest supports custom ignore patterns using a `.aidigestignore` file in the root directory of your project. This file works similarly to `.gitignore`, allowing you to specify files and directories that should be excluded from the aggregation.

Use the `--show-output-files` flag to see which files are being included, making it easier to identify candidates for exclusion.

## Whitespace Removal

When using the `--whitespace-removal` flag, ai-digest removes excess whitespace from files to reduce the token count when used with AI models. This feature is disabled for whitespace-dependent languages like Python and YAML.

## Binary and SVG File Handling

Binary files and SVGs are included in the output with a note about their file type. This allows AI models to be aware of these files without including their full content.

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

## Library Usage

You can use ai-digest programmatically in your Node.js applications:

```javascript
// ESM
import aiDigest from "ai-digest";
// or CommonJS
const aiDigest = require("ai-digest").default;

// Write to file (basic usage)
await aiDigest.generateDigest({
  inputDir: "./my-project",
  outputFile: "my-digest.md",
});

// Get content as string
const content = await aiDigest.generateDigest({
  inputDir: "./my-project",
  outputFile: null, // Return content as string instead of writing to file
  silent: true, // Suppress console output
});
```

## API Reference

### Main Functions

#### `generateDigest(options)`

The main function for programmatic usage. Generates a digest and either returns it as a string or writes it to a file.

**Parameters:**

- `options` (Object, optional): Configuration options
  - `inputDir` (string, optional): Input directory path (default: `process.cwd()`)
  - `outputFile` (string | null, optional): Output file path or `null` to return as string (default: `"codebase.md"`)
  - `useDefaultIgnores` (boolean, optional): Whether to use default ignore patterns (default: `true`)
  - `removeWhitespaceFlag` (boolean, optional): Whether to remove whitespace (default: `false`)
  - `ignoreFile` (string, optional): Custom ignore file name (default: `".aidigestignore"`)
  - `showOutputFiles` (boolean, optional): Whether to display included files (default: `false`)
  - `silent` (boolean, optional): Whether to suppress console output (default: `false`)

**Returns:**

- If `outputFile` is `null`: A Promise resolving to the digest content as a string
- Otherwise: A Promise resolving to `void` (content is written to file)

**Example:**

```javascript
// Return as string
const content = await aiDigest.generateDigest({
  inputDir: "./src",
  outputFile: null,
  removeWhitespaceFlag: true,
  silent: true,
});

// Write to file
await aiDigest.generateDigest({
  inputDir: "./src",
  outputFile: "src-digest.md",
});
```

#### `generateDigestContent(options)`

Low-level function to generate the digest content and statistics without writing to a file.

**Parameters:**

- `options` (Object): Configuration options
  - `inputDir` (string): Input directory path
  - `outputFilePath` (string | null, optional): Output file path (to exclude from digest) or `null`
  - `useDefaultIgnores` (boolean, optional): Whether to use default ignore patterns (default: `true`)
  - `removeWhitespaceFlag` (boolean, optional): Whether to remove whitespace (default: `false`)
  - `ignoreFile` (string, optional): Custom ignore file name (default: `".aidigestignore"`)
  - `silent` (boolean, optional): Whether to suppress console output (default: `false`)

**Returns:**

- A Promise resolving to an Object containing:
  - `content` (string): The generated digest content
  - `stats` (Object): Statistics about the digest
    - `totalFiles` (number): Total number of files found
    - `includedCount` (number): Number of files included in the digest
    - `defaultIgnoredCount` (number): Number of files ignored by default patterns
    - `customIgnoredCount` (number): Number of files ignored by custom patterns
    - `binaryAndSvgFileCount` (number): Number of binary and SVG files included
    - `includedFiles` (string[]): Array of included file paths
    - `estimatedTokens` (number): Estimated token count for AI models
    - `fileSizeInBytes` (number): Size of the digest content in bytes

**Example:**

```javascript
const { content, stats } = await aiDigest.generateDigestContent({
  inputDir: "./project",
  silent: true,
});

console.log(`Generated digest contains ${stats.includedCount} files`);
console.log(`Estimated token count: ${stats.estimatedTokens}`);
```

#### `writeDigestToFile(content, outputFile, stats, showOutputFiles)`

Writes the generated digest content to a file and displays statistics.

**Parameters:**

- `content` (string): The digest content to write
- `outputFile` (string): Path to write the output file
- `stats` (Object): Statistics object from `generateDigestContent`
- `showOutputFiles` (boolean, optional): Whether to display the list of included files (default: `false`)

**Returns:**

- A Promise resolving to `void`

**Example:**

```javascript
const { content, stats } = await aiDigest.generateDigestContent({
  inputDir: "./project",
});

// Process or modify the content if needed
const processedContent = content.replace(/some pattern/g, "replacement");

// Write to file
await aiDigest.writeDigestToFile(
  processedContent,
  "modified-digest.md",
  stats,
  true
);
```
