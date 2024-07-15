# agg-cli

A CLI tool to aggregate your codebase into a single Markdown file for use with Claude Projects or custom ChatGPTs.

## Features

- Aggregates all files in the current directory and subdirectories
- Ignores common build artifacts and configuration files
- Supports custom ignore patterns via `.aggignore`
- Outputs a single Markdown file with syntax highlighting

## Installation

```bash
npm install -g agg-cli
```

## Usage

```bash
agg
```

Options:
- `-o, --output <file>`: Specify output file (default: codebase.md)
- `--no-default-ignores`: Disable default ignore patterns

## Example

```bash
agg -o project_summary.md
```

This creates a `project_summary.md` file containing your entire codebase, ready for AI analysis.