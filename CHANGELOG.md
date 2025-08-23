### 1.5.0

- Added `.aidigestminify` file support for including files with placeholder content instead of full content
- Files matching minify patterns are included but show only file type and a message that content is excluded
- Added `--minify-file` CLI option to specify custom minify file name
- Watch mode now monitors `.aidigestminify` file for changes
- All library functions now support `minifyFile` option

### 1.4.1

- Added `additionalDefaultIgnores` option to file processing functions
- Allows users to specify extra glob patterns to ignore programmatically
- Available in `processFiles`, `generateDigestFiles`, `generateDigestContent`, and `getFileStats`

### 1.4.0

- Switch from `js-tiktoken` to `tiktoken` package for better performance and compatibility
- Performance improvement: ~35% faster token counting
- Add token analysis scripts: `analyze-tokens`, `calculate-multiplier`, `test-multiplier`
- Remove redundant dual OpenAI tokenization for better efficiency

### 1.3.0

- Add `getFileStats()` function to retrieve file statistics without content (#32)
- Returns file path, size, and total token counts (GPT and Claude) sorted by size
- Update Prettier script to exclude .snap files from formatting
- Add comprehensive snapshot tests for new API function

### 1.2.4

- Bug fixes and stability improvements (#30)

### 1.2.3

- Enable TypeScript declaration file generation for better IDE support
- Add library support for using ai-digest as external npm package (#18)
- Export functions: `generateDigest`, `generateDigestContent`, `generateDigestFiles`, `writeDigestToFile`
- Comprehensive API documentation for programmatic usage

### 1.2.2

- Bump lockfile

### 1.2.1

- Fix bug with paths when `npx ai-digest` is used in a subfolder of a monorepo

### 1.2.0

- Support multiple input folders (eg `--input folder1 folder2`)
- Add Claude Sonnet token estimation
- Upgrade packages

### 1.1.0

- Added `--watch` flag for watch mode
- Enhanced `--show-output-files` to display file size statistics with visual bar charts
- Added `--show-output-files sort` option to sort files by size (largest first)
