# code-koala

A CLI tool to aggregate your codebase into a single Markdown file for use with Claude Projects or custom ChatGPTs.

## Features

- Aggregates all files in the current directory and subdirectories
- Ignores common build artifacts and configuration files
- Supports custom ignore patterns via `.aggignore`
- Outputs a single Markdown file with syntax highlighting
- Optional whitespace removal to reduce token count

## Installation

```bash
npm install -g code-koala
```

## Usage

```bash
code-koala
```

This will generate a `codebase.md` file with your codebase.

Options:
- `-o, --output <file>`: Specify output file (default: codebase.md)
- `--no-default-ignores`: Disable default ignore patterns
- `--whitespace-removal`: Enable whitespace removal

## Example

```bash
code-koala -o project_summary.md --whitespace-removal
```

This creates a `project_summary.md` file containing your entire codebase with whitespace removed, ready for AI analysis.

## Custom Ignore Patterns

code-koala supports custom ignore patterns using a `.aggignore` file in the root directory of your project. This file works similarly to `.gitignore`, allowing you to specify files and directories that should be excluded from the aggregation.

## Whitespace Removal

By default, code-koala removes excess whitespace from files to reduce the token count when used with AI models. This feature is disabled for whitespace-dependent languages like Python and YAML. Use `--no-whitespace-removal` to keep all whitespace intact.