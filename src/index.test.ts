import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

const runCLI = async (args: string = "") => {
  const cliPath = path.resolve(__dirname, "index.ts");
  return execAsync(`ts-node ${cliPath} ${args}`);
};

describe("AI Digest CLI", () => {
  afterAll(async () => {
    // Remove the created .md files after all tests complete
    await fs
      .unlink(path.resolve(__dirname, "..", "codebase.md"))
      .catch(() => {});
    await fs
      .unlink(path.resolve(__dirname, "..", "custom_output.md"))
      .catch(() => {});
  });

  it("should generate codebase.md by default", async () => {
    const { stdout } = await runCLI();
    expect(stdout).toMatch(/Files aggregated successfully into .*codebase\.md/);
  }, 10000);

  it("should respect custom output file", async () => {
    const { stdout } = await runCLI("-o custom_output.md");
    expect(stdout).toMatch(/Files aggregated successfully into .*custom_output\.md/);
  }, 10000);

  it("should ignore files based on .aidigestignore", async () => {
    const { stdout } = await runCLI();
    expect(stdout).toContain("Files ignored by .aidigestignore:");
  }, 10000);

  it("should remove whitespace when flag is set", async () => {
    const { stdout } = await runCLI("--whitespace-removal");
    expect(stdout).toContain("Whitespace removal enabled");
  }, 10000);

  it("should not remove whitespace for whitespace-dependent files", async () => {
    const { stdout } = await runCLI("--whitespace-removal");
    expect(stdout).toContain(
      "Whitespace removal enabled (except for whitespace-dependent languages)"
    );
  }, 10000);

  it("should disable default ignores when flag is set", async () => {
    const { stdout } = await runCLI("--no-default-ignores");
    expect(stdout).toContain("Default ignore patterns disabled");
  }, 10000);

  it("should include binary files with a note", async () => {
    const { stdout } = await runCLI();
    expect(stdout).toMatch(/Binary and SVG files included: \d+/);
  }, 10000);

  it("should show output files when flag is set", async () => {
    const { stdout } = await runCLI("--show-output-files");
    expect(stdout).toContain("Files included in the output:");
  }, 10000);

  it("should include SVG file with correct type in codebase.md", async () => {
    await runCLI();
    const codebasePath = path.resolve(__dirname, "..", "codebase.md");
    const content = await fs.readFile(codebasePath, 'utf-8');
    
    expect(content).toContain("# test/smiley.svg");
    expect(content).toContain("This is a file of the type: SVG Image");
  }, 10000);

  it("should respect the --input flag", async () => {
    // Create a temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-digest-test-'));
  
    try {
      // Create some test files in the temporary directory
      await fs.writeFile(path.join(tempDir, 'test1.txt'), 'Test content 1');
      await fs.writeFile(path.join(tempDir, 'test2.js'), 'console.log("Test content 2");');
      
      // Create a subdirectory with a file
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, 'test3.py'), 'print("Test content 3")');
  
      // Run the CLI with the --input flag
      const { stdout } = await runCLI(`--input ${tempDir} --show-output-files`);
  
      // Check if the output contains only the files we created
      expect(stdout).toContain('test1.txt');
      expect(stdout).toContain('test2.js');
      expect(stdout).toContain('subdir/test3.py');
  
      // Check if the output doesn't contain files from the project directory
      expect(stdout).not.toContain('package.json');
      expect(stdout).not.toContain('tsconfig.json');
  
      // Read the generated codebase.md file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, 'utf-8');
  
      // Verify the content of codebase.md
      expect(content).toContain('# test1.txt');
      expect(content).toContain('Test content 1');
      expect(content).toContain('# test2.js');
      expect(content).toContain('console.log("Test content 2");');
      expect(content).toContain('# subdir/test3.py');
      expect(content).toContain('print("Test content 3")');
  
    } finally {
      // Clean up: remove the temporary directory and its contents
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 15000); // Increased timeout to 15 seconds due to file operations

  it("should respect custom ignore file", async () => {
    // Create a temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-digest-custom-ignore-test-'));
  
    try {
      // Create some test files in the temporary directory
      await fs.writeFile(path.join(tempDir, 'include.txt'), 'This file should be included');
      await fs.writeFile(path.join(tempDir, 'exclude.js'), 'This file should be excluded');
      
      // Create a custom ignore file
      await fs.writeFile(path.join(tempDir, 'custom.ignore'), '*.js');

      // Run the CLI with the custom ignore file
      const { stdout } = await runCLI(`--input ${tempDir} --ignore-file custom.ignore --show-output-files`);

      // Check if the output contains only the files we want to include
      expect(stdout).toContain('include.txt');
      expect(stdout).not.toContain('exclude.js');

      // Check if the custom ignore patterns are mentioned
      expect(stdout).toContain('Ignore patterns from custom.ignore:');
      expect(stdout).toContain('  - *.js');

      // Read the generated codebase.md file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, 'utf-8');

      // Verify the content of codebase.md
      expect(content).toContain('# include.txt');
      expect(content).toContain('This file should be included');
      expect(content).not.toContain('# exclude.js');
      expect(content).not.toContain('This file should be excluded');

    } finally {
      // Clean up: remove the temporary directory and its contents
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("should respect the --ignore flag", async () => {
    // Create a temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-digest-ignore-flag-test-'));
  
    try {
      // Create some test files in the temporary directory
      await fs.writeFile(path.join(tempDir, 'include.txt'), 'This file should be included');
      await fs.writeFile(path.join(tempDir, 'exclude.js'), 'This file should be excluded');
      await fs.writeFile(path.join(tempDir, 'also_exclude.py'), 'This file should also be excluded');

      // Run the CLI with the --ignore flag
      const { stdout } = await runCLI(`--input ${tempDir} --ignore '*.js' --ignore '*.py' --show-output-files`);

      // Check if the output contains only the files we want to include
      expect(stdout).toContain('include.txt');
      expect(stdout).not.toContain('exclude.js');
      expect(stdout).not.toContain('also_exclude.py');

      // Check if the ignore patterns are mentioned
      expect(stdout).toContain('Ignore patterns from command line:');
      expect(stdout).toContain('  - *.js');
      expect(stdout).toContain('  - *.py');

      // Read the generated codebase.md file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, 'utf-8');

      // Verify the content of codebase.md
      expect(content).toContain('# include.txt');
      expect(content).toContain('This file should be included');
      expect(content).not.toContain('# exclude.js');
      expect(content).not.toContain('This file should be excluded');
      expect(content).not.toContain('# also_exclude.py');
      expect(content).not.toContain('This file should also be excluded');

    } finally {
      // Clean up: remove the temporary directory and its contents
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  })
});