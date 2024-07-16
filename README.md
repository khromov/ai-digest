# ai-digest

A CLI tool to aggregate your codebase into a single Markdown file for use with Claude Projects or custom ChatGPTs.

## Features

- Aggregates all files in the current directory and subdirectories
- Ignores common build artifacts and configuration files
- Outputs a single Markdown file containing the whole codebase.

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

- `-o, --output <file>`: Specify output file (default: codebase.md)
- `--no-default-ignores`: Disable default ignore patterns
- `--whitespace-removal`: Enable whitespace removal
- `--help`: Show help

## Example

```bash
npx ai-digest -o project_summary.md --whitespace-removal
```

This creates a `project_summary.md` file containing your entire codebase with whitespace removed, ready for AI analysis.

## Custom Ignore Patterns

ai-digest supports custom ignore patterns using a `.aidigestignore` file in the root directory of your project. This file works similarly to `.gitignore`, allowing you to specify files and directories that should be excluded from the aggregation.

## Whitespace Removal

When using the `--whitespace-removal` flag, ai-digest removes excess whitespace from files to reduce the token count when used with AI models. This feature is disabled for whitespace-dependent languages like Python and YAML.

## Local dev

Run `npm run start` to run the CLI tool on the local project. (Very meta!)

Run `npm test` to run the tests.