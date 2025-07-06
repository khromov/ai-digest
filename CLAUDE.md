# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build` - Compiles TypeScript code to dist/
- Start: `npm run start` - Run the application with ts-node for development
- Test: `npm run test` - Run all Jest tests
- Single test: `npx jest src/index.test.ts -t "test name"` - Run specific test by name
- Update snapshots: `npm run test -- -u` - Update Jest snapshots after changes
- Format: `npm run prettier` - Format code with Prettier (excludes .snap files)
- Publish: `npm run prepublishOnly` - Automatically runs build before publishing

## Version Management
When adding a new feature or making significant changes:
1. Bump the version in package.json following semantic versioning:
   - MAJOR version for incompatible API changes
   - MINOR version for new functionality in a backward compatible manner (e.g., 1.2.4 → 1.3.0)
   - PATCH version for backward compatible bug fixes
2. Run `npm install` to update package-lock.json
3. Document the new feature/change in CLAUDE.md with version number
4. Claude should automatically suggest version bumping when a new feature is added (only once per conversation)

## Project Architecture

This is a CLI tool called "ai-digest" that aggregates files into a single Markdown file for use with AI models. It operates both as a CLI tool (via Commander.js) and as a Node.js library with multiple export patterns.

### Dual CLI/Library Design
The architecture supports two usage patterns:
- **CLI Mode**: Command-line interface with file watching, progress display, and console output
- **Library Mode**: Programmatic API returning data structures for integration with other tools

### Core Processing Pipeline
1. **File Discovery**: Uses glob patterns to scan directories, respecting ignore patterns
2. **Binary Detection**: Separates text files from binary files using `isbinaryfile` and file extensions
3. **Content Processing**: Text files are wrapped in markdown code blocks; binary files get descriptive text
4. **Token Estimation**: Calculates token counts using both GPT-4 and Claude tokenizers
5. **Output Generation**: Combines processed files into a single markdown document

### Key Components
- `src/index.ts` - Main entry point containing CLI logic, library exports, and core processing functions
- `src/utils.ts` - Utility functions for file processing, token counting, ignore patterns, and file type detection
- `src/index.test.ts` - Comprehensive test suite covering both CLI and library functionality

### Critical Functions
- `processFiles()` - Core processing pipeline that handles file discovery, content processing, and statistics
- `generateDigestContent()` - Main library function that returns content + files + stats
- `generateDigest()` - Higher-level function for simple string output or file writing
- `generateDigestFiles()` - Returns array of processed file objects for custom processing
- `getFileStats()` - Returns file statistics sorted by processed content size with total token counts (added in v1.3.0)
- `writeDigestToFile()` - Handles file writing with progress display and statistics
- `watchFiles()` - Implements file watching with debouncing for auto-rebuild

### File Size Calculation Strategy
The tool consistently uses processed content size (markdown wrapper + content) for all file size calculations and displays. This ensures consistency between CLI output and library functions.

### Testing Architecture
- **CLI Tests**: Use `execAsync` with `ts-node` to test actual CLI behavior
- **Library Tests**: Direct function imports for unit testing
- **Temporary Directories**: Each test creates isolated temp directories for file operations
- **Snapshot Testing**: Used for complex output structures (file stats, processed content)
- **Binary File Testing**: Includes tests for actual binary files (mascot.jpg, smiley.svg)

### Token Counting
Dual tokenization using:
- `js-tiktoken` for GPT-4 compatibility
- `@anthropic-ai/tokenizer` for Claude models
- Graceful fallback to approximations if tokenization fails

## Library Usage
The tool exports functions for programmatic use:
- `generateDigest(options)` - Returns content string when `outputFile: null`, writes file otherwise
- `generateDigestContent(options)` - Returns `{ content, files, stats }` for full control
- `generateDigestFiles(options)` - Returns `{ files }` array for custom filtering/processing
- `getFileStats(options)` - Returns file statistics sorted by size with total token counts, no content
- `writeDigestToFile(content, outputFile, stats, showOutputFiles, fileSizes)` - File writing utility

## Code Style & Patterns
- Use 2 spaces for indentation
- Prefer double quotes for strings
- Explicit typing for function parameters and returns
- Use async/await for asynchronous operations
- Handle errors with try/catch blocks using `formatLog` for consistent error formatting
- Group related constants at the top of files
- Use descriptive variable names and avoid abbreviations
- Wrap CLI execution in utility functions when testing (`runCLI`, `runCLIWithEnv`)
- Add timeout values to Jest tests for file operations (10000-15000ms)
- Use snapshot testing for complex data structures that should remain stable
- Binary files should be tested with actual binary data, not mocked content