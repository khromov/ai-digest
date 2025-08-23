import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

const execAsync = promisify(exec);

const runCLI = async (args: string = "") => {
  const cliPath = path.resolve(__dirname, "index.ts");
  return execAsync(`ts-node ${cliPath} ${args}`);
};

// New helper to run CLI with specific environment variables
const runCLIWithEnv = async (
  args: string = "",
  env: Record<string, string> = {}
) => {
  const cliPath = path.resolve(__dirname, "index.ts");
  const envVars = Object.entries(env)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return execAsync(`${envVars} ts-node ${cliPath} ${args}`);
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
    expect(stdout).toMatch(
      /Files aggregated successfully into .*custom_output\.md/
    );
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
    const content = await fs.readFile(codebasePath, "utf-8");

    expect(content).toContain("# test/smiley.svg");
    expect(content).toContain("This is a file of the type: SVG Image");
  }, 10000);

  it("should respect the --input flag", async () => {
    // Create a temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-digest-test-"));

    try {
      // Create some test files in the temporary directory
      await fs.writeFile(path.join(tempDir, "test1.txt"), "Test content 1");
      await fs.writeFile(
        path.join(tempDir, "test2.js"),
        "console.log(\"Test content 2\");"
      );

      // Create a subdirectory with a file
      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir);
      await fs.writeFile(
        path.join(subDir, "test3.py"),
        "print(\"Test content 3\")"
      );

      // Run the CLI with the --input flag
      const { stdout } = await runCLI(`--input ${tempDir} --show-output-files`);

      // Check if the output contains only the files we created
      expect(stdout).toContain("test1.txt");
      expect(stdout).toContain("test2.js");
      expect(stdout).toContain("subdir/test3.py");

      // Check if the output doesn't contain files from the project directory
      expect(stdout).not.toContain("package.json");
      expect(stdout).not.toContain("tsconfig.json");

      // Read the generated codebase.md file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, "utf-8");

      // Verify the content of codebase.md
      expect(content).toContain("# test1.txt");
      expect(content).toContain("Test content 1");
      expect(content).toContain("# test2.js");
      expect(content).toContain("console.log(\"Test content 2\");");
      expect(content).toContain("# subdir/test3.py");
      expect(content).toContain("print(\"Test content 3\")");
    } finally {
      // Clean up: remove the temporary directory and its contents
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 15000); // Increased timeout to 15 seconds due to file operations

  it("should respect custom ignore file", async () => {
    // Create a temporary directory
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-custom-ignore-test-")
    );

    try {
      // Create some test files in the temporary directory
      await fs.writeFile(
        path.join(tempDir, "include.txt"),
        "This file should be included"
      );
      await fs.writeFile(
        path.join(tempDir, "exclude.js"),
        "This file should be excluded"
      );

      // Create a custom ignore file
      await fs.writeFile(path.join(tempDir, "custom.ignore"), "*.js");

      // Run the CLI with the custom ignore file
      const { stdout } = await runCLI(
        `--input ${tempDir} --ignore-file custom.ignore --show-output-files`
      );

      // Check if the output contains only the files we want to include
      expect(stdout).toContain("include.txt");
      expect(stdout).not.toContain("exclude.js");

      // Check if the custom ignore patterns are mentioned
      expect(stdout).toContain("Ignore patterns from custom.ignore:");
      expect(stdout).toContain("  - *.js");

      // Read the generated codebase.md file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, "utf-8");

      // Verify the content of codebase.md
      expect(content).toContain("# include.txt");
      expect(content).toContain("This file should be included");
      expect(content).not.toContain("# exclude.js");
      expect(content).not.toContain("This file should be excluded");
    } finally {
      // Clean up: remove the temporary directory and its contents
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("should sort files in natural path order", async () => {
    // Create a temporary directory
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-sort-test-")
    );

    try {
      // Create test files and directories
      await fs.mkdir(path.join(tempDir, "01-first"));
      await fs.mkdir(path.join(tempDir, "02-second"));
      await fs.mkdir(path.join(tempDir, "10-tenth"));

      await fs.writeFile(
        path.join(tempDir, "01-first", "01-file.txt"),
        "First file"
      );
      await fs.writeFile(
        path.join(tempDir, "01-first", "02-file.txt"),
        "Second file"
      );
      await fs.writeFile(
        path.join(tempDir, "02-second", "01-file.txt"),
        "Third file"
      );
      await fs.writeFile(
        path.join(tempDir, "10-tenth", "01-file.txt"),
        "Fourth file"
      );
      await fs.writeFile(path.join(tempDir, "root-file.txt"), "Root file");

      // Run the CLI with the test directory
      await runCLI(`--input ${tempDir}`);

      // Read the generated codebase.md file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, "utf-8");

      // Define the expected order of file headers
      const expectedOrder = [
        "# 01-first/01-file.txt",
        "# 01-first/02-file.txt",
        "# 02-second/01-file.txt",
        "# 10-tenth/01-file.txt",
        "# root-file.txt",
      ];

      // Check if all expected headers are present and in the correct order
      let lastIndex = -1;
      for (const header of expectedOrder) {
        const currentIndex = content.indexOf(header);
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      }
    } finally {
      // Clean up: remove the temporary directory and its contents
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("should recognize the --watch flag", async () => {
    try {
      // Run CLI with watch flag and NODE_ENV=test to exit early
      const { stdout } = await runCLIWithEnv("--watch", { NODE_ENV: "test" });

      // Verify watch mode was initialized but did not hang
      expect(stdout).toContain("Watch mode enabled");
      expect(stdout).toContain("Waiting for file changes");
    } catch (error) {
      // If there's any error, it should still have shown the watch messages
      fail(`Watch test failed: ${error}`);
    }
  }, 10000);

  // Test for multiple input directories
  it("should handle multiple input directories", async () => {
    // Create two temporary directories
    const tempDir1 = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-test-dir1-")
    );
    const tempDir2 = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-test-dir2-")
    );

    try {
      // Create test files in first directory
      await fs.writeFile(
        path.join(tempDir1, "dir1-file1.txt"),
        "Content from dir1"
      );
      await fs.writeFile(
        path.join(tempDir1, "common.txt"),
        "Common file in dir1"
      );

      // Create test files in second directory
      await fs.writeFile(
        path.join(tempDir2, "dir2-file1.txt"),
        "Content from dir2"
      );
      await fs.writeFile(
        path.join(tempDir2, "common.txt"),
        "Common file in dir2"
      );

      // Run CLI with multiple input directories
      const { stdout } = await runCLI(
        `--input ${tempDir1} ${tempDir2} --show-output-files`
      );

      // Verify output
      expect(stdout).toContain(`Scanning directory: ${tempDir1}`);
      expect(stdout).toContain(`Scanning directory: ${tempDir2}`);

      // Verify files from both directories are included
      expect(stdout).toContain(`${path.basename(tempDir1)}/dir1-file1.txt`);
      expect(stdout).toContain(`${path.basename(tempDir2)}/dir2-file1.txt`);
      expect(stdout).toContain(`${path.basename(tempDir1)}/common.txt`);
      expect(stdout).toContain(`${path.basename(tempDir2)}/common.txt`);

      // Read the generated codebase.md file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, "utf-8");

      // Verify content from both directories is included
      expect(content).toContain(`# ${path.basename(tempDir1)}/dir1-file1.txt`);
      expect(content).toContain("Content from dir1");
      expect(content).toContain(`# ${path.basename(tempDir2)}/dir2-file1.txt`);
      expect(content).toContain("Content from dir2");

      // Check common files are included with directory prefixes
      expect(content).toContain(`# ${path.basename(tempDir1)}/common.txt`);
      expect(content).toContain("Common file in dir1");
      expect(content).toContain(`# ${path.basename(tempDir2)}/common.txt`);
      expect(content).toContain("Common file in dir2");
    } finally {
      // Clean up the temporary directories
      await fs.rm(tempDir1, { recursive: true, force: true });
      await fs.rm(tempDir2, { recursive: true, force: true });
    }
  }, 15000);

  // New test for working directory behavior
  it("should respect INIT_CWD when different from process.cwd()", async () => {
    // Create a temporary directory structure
    const tempRootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-wd-test-")
    );
    const subDir = path.join(tempRootDir, "subdir");
    await fs.mkdir(subDir);

    // Create test files
    await fs.writeFile(
      path.join(tempRootDir, "root-file.txt"),
      "Root file content"
    );

    try {
      // Run with INIT_CWD set to subdirectory but cwd unchanged
      const env = { INIT_CWD: subDir };

      // Use the tempRootDir as input to have files to process
      await runCLIWithEnv(`--input ${tempRootDir}`, env);

      // Verify the file was created in the subdirectory (INIT_CWD)
      const subDirOutputPath = path.join(subDir, "codebase.md");
      const fileExists = await fs
        .access(subDirOutputPath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);

      // Verify content includes the root file
      const content = await fs.readFile(subDirOutputPath, "utf-8");
      expect(content).toContain("root-file.txt");
      expect(content).toContain("Root file content");

      // Clean up the output file
      await fs.unlink(subDirOutputPath).catch(() => {});
    } finally {
      // Clean up the test directories
      await fs.rm(tempRootDir, { recursive: true, force: true });
    }
  }, 15000);
});
