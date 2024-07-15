# code-koala

A CLI tool to aggregate your codebase into a single Markdown file for use with Claude Projects or custom ChatGPTs.

## Features

- Aggregates all files in the current directory and subdirectories
- Ignores common build artifacts and configuration files
- Supports custom ignore patterns via `.aggignore`
- Outputs a single Markdown file with syntax highlighting
- Optionally removes whitespace to reduce token count

## Installation

```bash
npm install -g code-koala
```

## Usage

```bash
code-koala
```

Options:
- `-o, --output <file>`: Specify output file (default: codebase.md)
- `--no-default-ignores`: Disable default ignore patterns
- `--no-whitespace-removal`: Disable whitespace removal (enabled by default)

## Example

```bash
code-koala -o project_summary.md
```

This creates a `project_summary.md` file containing your entire codebase, ready for AI analysis.

## Whitespace Removal

By default, code-koala removes excess whitespace from files to reduce the token count when used with AI models. This feature is disabled for whitespace-dependent languages like Python and YAML. Use `--no-whitespace-removal` to keep all whitespace intact.