# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Build: `npm run build` - Compiles TypeScript code
- Start: `npm run start` - Run the application with ts-node
- Test: `npm run test` - Run all Jest tests
- Single test: `npx jest src/index.test.ts -t "should respect custom output file"` - Run specific test
- Format: `npm run prettier` - Format code with Prettier

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