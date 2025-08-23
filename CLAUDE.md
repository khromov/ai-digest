# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build` - Compiles TypeScript code to dist/
- Start: `npm run start` - Run the application with ts-node for development
- Test: `npm run test` - Run all Jest tests (configured to run serially to prevent file conflicts)
- Single test: `npx jest src/cli.test.ts -t "test name"` - Run specific test by name
- Update snapshots: `npm run test -- -u` - Update Jest snapshots after changes
- Format: `npm run format` - Format code with ESLint auto-fix
- Format (legacy): `npm run prettier` - Format code with Prettier (excludes .snap files)
- Lint: `npm run lint` - Check code with ESLint without fixing
- Publish: `npm run prepublishOnly` - Automatically runs build before publishing

## Token Analysis Scripts
- `npm run analyze-tokens` - Full analysis of Claude vs OpenAI token counts using Moby Dick
- `npm run calculate-multiplier` - Calculate the Claude to OpenAI token multiplier
- `npm run test-multiplier` - Test the current multiplier implementation with sample texts

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
4. **Token Estimation**: Calculates token counts using Claude tokenizer with OpenAI estimation via multiplier
5. **Output Generation**: Combines processed files into a single markdown document

### Key Components
- `src/index.ts` - Main entry point containing CLI logic and library exports
- `src/digest.ts` - Core processing functions for file discovery, content processing, and output generation
- `src/utils.ts` - Utility functions for file processing, token counting, ignore patterns, and file type detection
- `src/types.ts` - TypeScript type definitions for the project
- `src/cli.test.ts` - CLI functionality tests (command-line interface behavior)
- `src/library.test.ts` - Core library function tests (generateDigest, generateDigestContent, etc.)
- `src/file-stats.test.ts` - File statistics tests (getFileStats function)
- `src/minify.test.ts` - Minify functionality tests (.aidigestminify patterns and callbacks)
- `scripts/` - Analysis and utility scripts for token counting research

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
- **Test Organization**: Tests are split into 4 files based on functionality:
  - `cli.test.ts` - CLI interface and command-line behavior
  - `library.test.ts` - Core library functions and API
  - `file-stats.test.ts` - File statistics and size calculation
  - `minify.test.ts` - Minify patterns and callback functionality
- **Serial Execution**: Jest is configured with `maxWorkers: 1` to prevent file conflicts during concurrent test execution
- **CLI Tests**: Use `execAsync` with `ts-node` to test actual CLI behavior
- **Library Tests**: Direct function imports for unit testing
- **Temporary Directories**: Each test creates isolated temp directories for file operations
- **Snapshot Testing**: Used for complex output structures (file stats, processed content)
- **Binary File Testing**: Includes tests for actual binary files (mascot.jpg, smiley.svg)

### Token Counting Optimization
**Performance Enhancement (v1.3.1)**: The tool now uses only Claude tokenization with a pre-calculated multiplier for OpenAI estimation:

- **Primary Tokenization**: Uses `@anthropic-ai/tokenizer` for Claude models
- **OpenAI Estimation**: Applies multiplier (0.9048) to estimate GPT tokens from Claude tokens
- **Performance**: ~35% faster than dual tokenization (Claude tokenization is faster than OpenAI WASM)
- **Accuracy**: 90-95% accurate for most English text, based on Moby Dick analysis
- **Multiplier Source**: Calculated from full Moby Dick analysis showing Claude produces ~10.5% more tokens than OpenAI

#### Token Analysis Scripts
- `scripts/analyze-token-ratio.ts` - Comprehensive analysis using Moby Dick text
- `scripts/calculate-multiplier.ts` - Simple multiplier calculation utility  
- `scripts/test-multiplier.ts` - Test current multiplier implementation

The multiplier (0.9048) was derived from analysis showing:
- Claude: 343,313 tokens
- OpenAI (GPT-4o): 310,641 tokens  
- Ratio: 0.9048 (OpenAI/Claude)

## Feature: .aidigestminify (v1.5.0)
Added support for `.aidigestminify` file which works similarly to `.aidigestignore` but instead of excluding files completely, it includes them with a placeholder message. This is useful for large generated files, compiled assets, or files that don't need their full content in the AI context.

**How it works:**
- Create a `.aidigestminify` file with patterns similar to `.gitignore`
- Files matching these patterns will be included with placeholder content
- The placeholder shows the file type and indicates the content was excluded
- Useful for: minified files, compiled code, large data files, database files

**Example patterns:**
```
*.min.js
*.min.css
dist/*
build/*
*.db
*.sqlite
```

**Implementation details:**
- Added `minifyFile` parameter to all core functions
- Modified `processFiles()` to check minify patterns before processing content
- Added `minifiedCount` to statistics tracking
- Watch mode monitors `.aidigestminify` file for changes
- CLI option `--minify-file` to specify custom minify file name

## Library Usage
The tool exports functions for programmatic use:
- `generateDigest(options)` - Returns content string when `outputFile: null`, writes file otherwise
- `generateDigestContent(options)` - Returns `{ content, files, stats }` for full control
- `generateDigestFiles(options)` - Returns `{ files }` array for custom filtering/processing
- `getFileStats(options)` - Returns file statistics sorted by size with total token counts, no content
- `writeDigestToFile(content, outputFile, stats, showOutputFiles, fileSizes)` - File writing utility

All library functions now support the `minifyFile` option for `.aidigestminify` patterns.

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

## Code Quality & Pre-commit Hooks
- ESLint is configured for TypeScript with basic formatting rules
- Pre-commit hook automatically runs ESLint fixes on staged files
- Use `npm run format` for manual code formatting with ESLint
- Use `npm run lint` to check for linting issues without auto-fixing

## Test Configuration
- Jest is configured to run tests serially (`maxWorkers: 1`) to prevent file conflicts during temporary file operations
- Tests are organized into 4 files by functionality: CLI, Library API, File Stats, and Minify features
- Each test uses unique temporary directories to avoid conflicts
- Shared output files (like `codebase.md`) are cleaned up in `afterAll` hooks
