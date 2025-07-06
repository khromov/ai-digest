# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build` - Compiles TypeScript code
- Start: `npm run start` - Run the application with ts-node
- Test: `npm run test` - Run all Jest tests
- Single test: `npx jest src/index.test.ts -t "should respect custom output file"` - Run specific test
- Format: `npm run prettier` - Format code with Prettier

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

This is a CLI tool called "ai-digest" that aggregates files into a single Markdown file for use with AI models. It can be used both as a CLI tool and as a Node.js library.

### Core Components
- `src/index.ts` - Main entry point containing CLI logic and library exports
- `src/utils.ts` - Utility functions for file processing, token counting, and ignore patterns
- `src/index.test.ts` - Jest tests for both CLI and library functionality

### Key Functions
- `generateDigest()` - Main library function for external usage
- `generateDigestContent()` - Core function that processes files and returns content + stats
- `writeDigestToFile()` - Writes digest content to file with stats display
- `watchFiles()` - Implements file watching for auto-rebuild functionality
- `getFileStats()` - Returns file statistics (path, size) sorted by size with total token counts, without content (added in v1.3.0)

### File Processing Flow
1. Read ignore patterns from `.aidigestignore` and apply default ignores
2. Scan directories using glob patterns
3. Filter files based on ignore patterns and binary detection
4. Process text files with optional whitespace removal
5. Generate Markdown output with syntax highlighting
6. Calculate token counts for both GPT and Claude models

## Library Usage
The tool exports functions for programmatic use:
- `generateDigest(options)` - Returns content string when `outputFile: null`
- `generateDigestContent(options)` - Lower-level function returning content and stats
- `writeDigestToFile(content, outputFile, stats)` - File writing utility
- `generateDigestFiles(options)` - Returns array of processed file objects with content
- `getFileStats(options)` - Returns file statistics sorted by size (largest first) with total token counts but no content

## Code Style
- Use 2 spaces for indentation
- Prefer double quotes for strings
- Explicit typing for function parameters and returns
- Use async/await for asynchronous operations
- Use camelCase for variable and function names
- Handle errors with try/catch blocks (see formatLog for error logging)
- Group related constants at the top of the file
- Use descriptive variable names
- Wrap CLI calls in utility functions when testing
- Add timeout values to Jest tests for file operations (10000-15000ms)
- Document CLI options in program declarations