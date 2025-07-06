import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Import the library functions for direct testing
import aiDigest, {
  generateDigest,
  generateDigestFiles,
  generateDigestContent,
  writeDigestToFile,
  getFileStats,
} from "./index";

const execAsync = promisify(exec);

const runCLI = async (args: string = "") => {
  const cliPath = path.resolve(__dirname, "index.ts");
  return execAsync(`ts-node ${cliPath} ${args}`);
};

// New helper to run CLI with specific environment variables
const runCLIWithEnv = async (
  args: string = "",
  env: Record<string, string> = {},
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
      /Files aggregated successfully into .*custom_output\.md/,
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
      "Whitespace removal enabled (except for whitespace-dependent languages)",
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
        'console.log("Test content 2");',
      );

      // Create a subdirectory with a file
      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir);
      await fs.writeFile(
        path.join(subDir, "test3.py"),
        'print("Test content 3")',
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
      expect(content).toContain('console.log("Test content 2");');
      expect(content).toContain("# subdir/test3.py");
      expect(content).toContain('print("Test content 3")');
    } finally {
      // Clean up: remove the temporary directory and its contents
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 15000); // Increased timeout to 15 seconds due to file operations

  it("should respect custom ignore file", async () => {
    // Create a temporary directory
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-custom-ignore-test-"),
    );

    try {
      // Create some test files in the temporary directory
      await fs.writeFile(
        path.join(tempDir, "include.txt"),
        "This file should be included",
      );
      await fs.writeFile(
        path.join(tempDir, "exclude.js"),
        "This file should be excluded",
      );

      // Create a custom ignore file
      await fs.writeFile(path.join(tempDir, "custom.ignore"), "*.js");

      // Run the CLI with the custom ignore file
      const { stdout } = await runCLI(
        `--input ${tempDir} --ignore-file custom.ignore --show-output-files`,
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
      path.join(os.tmpdir(), "ai-digest-sort-test-"),
    );

    try {
      // Create test files and directories
      await fs.mkdir(path.join(tempDir, "01-first"));
      await fs.mkdir(path.join(tempDir, "02-second"));
      await fs.mkdir(path.join(tempDir, "10-tenth"));

      await fs.writeFile(
        path.join(tempDir, "01-first", "01-file.txt"),
        "First file",
      );
      await fs.writeFile(
        path.join(tempDir, "01-first", "02-file.txt"),
        "Second file",
      );
      await fs.writeFile(
        path.join(tempDir, "02-second", "01-file.txt"),
        "Third file",
      );
      await fs.writeFile(
        path.join(tempDir, "10-tenth", "01-file.txt"),
        "Fourth file",
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
    // This test verifies the CLI recognizes the --watch flag
    // Set NODE_ENV to test to ensure watchFiles() exits early
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    try {
      // Run CLI with watch flag
      const { stdout } = await runCLI("--watch");

      // Verify watch mode was initialized but did not hang
      expect(stdout).toContain("Watch mode enabled");
      expect(stdout).toContain("Waiting for file changes");
    } finally {
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    }
  }, 10000);

  // Test for multiple input directories
  it("should handle multiple input directories", async () => {
    // Create two temporary directories
    const tempDir1 = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-test-dir1-"),
    );
    const tempDir2 = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-test-dir2-"),
    );

    try {
      // Create test files in first directory
      await fs.writeFile(
        path.join(tempDir1, "dir1-file1.txt"),
        "Content from dir1",
      );
      await fs.writeFile(
        path.join(tempDir1, "common.txt"),
        "Common file in dir1",
      );

      // Create test files in second directory
      await fs.writeFile(
        path.join(tempDir2, "dir2-file1.txt"),
        "Content from dir2",
      );
      await fs.writeFile(
        path.join(tempDir2, "common.txt"),
        "Common file in dir2",
      );

      // Run CLI with multiple input directories
      const { stdout } = await runCLI(
        `--input ${tempDir1} ${tempDir2} --show-output-files`,
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
      path.join(os.tmpdir(), "ai-digest-wd-test-"),
    );
    const subDir = path.join(tempRootDir, "subdir");
    await fs.mkdir(subDir);

    // Create test files
    await fs.writeFile(
      path.join(tempRootDir, "root-file.txt"),
      "Root file content",
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

// New tests for library functionality
describe("AI Digest Library API", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-digest-lib-test-"));

    // Create some test files
    await fs.writeFile(path.join(tempDir, "file1.txt"), "Test content 1");
    await fs.writeFile(
      path.join(tempDir, "file2.js"),
      'console.log("Test content 2");',
    );

    // Create a subdirectory with a file
    const subDir = path.join(tempDir, "subdir");
    await fs.mkdir(subDir);
    await fs.writeFile(
      path.join(subDir, "file3.py"),
      'print("Test content 3")',
    );
  });

  afterEach(async () => {
    // Clean up temporary directory after each test
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should be importable as a module", () => {
    expect(aiDigest).toBeDefined();
    expect(generateDigest).toBeDefined();
    expect(generateDigestFiles).toBeDefined();
    expect(generateDigestContent).toBeDefined();
    expect(writeDigestToFile).toBeDefined();
  });

  it("should generate digest content as a string when outputFile is null", async () => {
    const content = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      silent: true,
    });

    expect(typeof content).toBe("string");

    // Check that all test files are included in the content
    expect(content).toContain("# file1.txt");
    expect(content).toContain("Test content 1");
    expect(content).toContain("# file2.js");
    expect(content).toContain('console.log("Test content 2");');
    expect(content).toContain("# subdir/file3.py");
    expect(content).toContain('print("Test content 3")');
  });

  it("should write to specified output file when outputFile is provided", async () => {
    const outputPath = path.join(tempDir, "output-digest.md");

    await generateDigest({
      inputDir: tempDir,
      outputFile: outputPath,
      silent: true,
    });

    // Verify the file was created
    const fileExists = await fs
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    // Check content
    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("# file1.txt");
    expect(content).toContain("Test content 1");
  });

  it("should use lower-level generateDigestContent function directly", async () => {
    const { content, stats } = await generateDigestContent({
      inputDir: tempDir,
      silent: true,
    });

    expect(typeof content).toBe("string");
    expect(stats).toMatchObject({
      totalFiles: 3,
      includedCount: 3,
      includedFiles: expect.arrayContaining([
        "file1.txt",
        "file2.js",
        "subdir/file3.py",
      ]),
    });
  });

  it("should respect whitespace removal option", async () => {
    // Create a file with whitespace
    await fs.writeFile(
      path.join(tempDir, "whitespace.js"),
      'function test() {\n    console.log("multiple    spaces");\n\n\n}',
    );

    // With whitespace removal
    const contentWithRemoval = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      removeWhitespaceFlag: true,
      silent: true,
    });

    // Without whitespace removal
    const contentWithoutRemoval = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      removeWhitespaceFlag: false,
      silent: true,
    });

    // With whitespace removal, the string should be more compact
    expect(contentWithRemoval).toContain(
      'function test() { console.log("multiple spaces"); }',
    );
    // Without whitespace removal, the original spacing should be preserved
    expect(contentWithoutRemoval).toContain(
      'function test() {\n    console.log("multiple    spaces");\n\n\n}',
    );
  });

  it("should respect ignore patterns", async () => {
    // Create an ignore file
    await fs.writeFile(path.join(tempDir, ".aidigestignore"), "*.js");

    const content = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      silent: true,
    });

    // JS file should be ignored
    expect(content).not.toContain("# file2.js");
    // Other files should be included
    expect(content).toContain("# file1.txt");
    expect(content).toContain("# subdir/file3.py");
  });

  it("should work with default export", async () => {
    const content = await aiDigest.generateDigest({
      inputDir: tempDir,
      outputFile: null,
      silent: true,
    });

    expect(typeof content).toBe("string");
    expect(content).toContain("# file1.txt");
  });

  it("should write digest to file and capture console output", async () => {
    // Spy on console.log
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    const { content, stats } = await generateDigestContent({
      inputDir: tempDir,
      silent: true,
    });

    const outputPath = path.join(tempDir, "console-test.md");
    await writeDigestToFile(content, outputPath, stats);

    // Verify console output was generated
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Files aggregated successfully"),
    );

    // Clean up
    consoleLogSpy.mockRestore();
  });

  it("should not generate console output in silent mode", async () => {
    // Spy on console.log
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await generateDigestContent({
      inputDir: tempDir,
      silent: true,
    });

    // No console output should be generated in silent mode
    expect(consoleLogSpy).not.toHaveBeenCalled();

    // Clean up
    consoleLogSpy.mockRestore();
  });

  it("should return array of file objects with generateDigestFiles", async () => {
    const result = await generateDigestFiles({
      inputDir: tempDir,
      silent: true,
    });

    expect(result).toHaveProperty("files");
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files).toHaveLength(3);

    // Check that each file has the expected structure
    result.files.forEach((file) => {
      expect(file).toHaveProperty("fileName");
      expect(file).toHaveProperty("content");
      expect(typeof file.fileName).toBe("string");
      expect(typeof file.content).toBe("string");
    });

    // Check specific files are included
    const fileNames = result.files.map((f) => f.fileName);
    expect(fileNames).toContain("file1.txt");
    expect(fileNames).toContain("file2.js");
    expect(fileNames).toContain("subdir/file3.py");
  });

  it("should format file content correctly in generateDigestFiles", async () => {
    const result = await generateDigestFiles({
      inputDir: tempDir,
      silent: true,
    });

    const file1 = result.files.find((f) => f.fileName === "file1.txt");
    expect(file1).toBeDefined();
    expect(file1!.content).toContain("# file1.txt");
    expect(file1!.content).toContain("```txt");
    expect(file1!.content).toContain("Test content 1");
    expect(file1!.content).toMatch(/```\n\n$/);

    const file2 = result.files.find((f) => f.fileName === "file2.js");
    expect(file2).toBeDefined();
    expect(file2!.content).toContain("# file2.js");
    expect(file2!.content).toContain("```js");
    expect(file2!.content).toContain('console.log("Test content 2");');
  });

  it("should respect ignore patterns with generateDigestFiles", async () => {
    // Create an ignore file
    await fs.writeFile(path.join(tempDir, ".aidigestignore"), "*.js");

    const result = await generateDigestFiles({
      inputDir: tempDir,
      silent: true,
    });

    const fileNames = result.files.map((f) => f.fileName);
    expect(fileNames).not.toContain("file2.js");
    expect(fileNames).toContain("file1.txt");
    expect(fileNames).toContain("subdir/file3.py");
  });

  it("should respect whitespace removal option with generateDigestFiles", async () => {
    // Create a file with whitespace
    await fs.writeFile(
      path.join(tempDir, "whitespace.js"),
      'function test() {\n    console.log("multiple    spaces");\n\n\n}',
    );

    // With whitespace removal
    const resultWithRemoval = await generateDigestFiles({
      inputDir: tempDir,
      removeWhitespaceFlag: true,
      silent: true,
    });

    // Without whitespace removal
    const resultWithoutRemoval = await generateDigestFiles({
      inputDir: tempDir,
      removeWhitespaceFlag: false,
      silent: true,
    });

    const whitespaceFileWithRemoval = resultWithRemoval.files.find(
      (f) => f.fileName === "whitespace.js",
    );
    const whitespaceFileWithoutRemoval = resultWithoutRemoval.files.find(
      (f) => f.fileName === "whitespace.js",
    );

    expect(whitespaceFileWithRemoval!.content).toContain(
      'function test() { console.log("multiple spaces"); }',
    );
    expect(whitespaceFileWithoutRemoval!.content).toContain(
      'function test() {\n    console.log("multiple    spaces");\n\n\n}',
    );
  });

  it("should work with multiple input directories in generateDigestFiles", async () => {
    // Create another temp directory
    const tempDir2 = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-test2-"),
    );

    try {
      // Create files in second directory
      await fs.writeFile(path.join(tempDir2, "file4.md"), "# Markdown content");

      const result = await generateDigestFiles({
        inputDirs: [tempDir, tempDir2],
        silent: true,
      });

      const fileNames = result.files.map((f) => f.fileName);

      // With multiple directories, all files should be prefixed with directory name
      const tempDir1Name = path.basename(tempDir);
      const tempDir2Name = path.basename(tempDir2);

      expect(fileNames).toContain(`${tempDir1Name}/file1.txt`);
      expect(fileNames).toContain(`${tempDir1Name}/file2.js`);
      expect(fileNames).toContain(`${tempDir2Name}/file4.md`);
    } finally {
      await fs.rm(tempDir2, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("should work with default export for generateDigestFiles", async () => {
    const result = await aiDigest.generateDigestFiles({
      inputDir: tempDir,
      silent: true,
    });

    expect(result).toHaveProperty("files");
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("should handle binary files correctly in generateDigestFiles", async () => {
    // Create a simple binary file (using Buffer to ensure it's binary)
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    await fs.writeFile(path.join(tempDir, "image.png"), binaryData);

    const result = await generateDigestFiles({
      inputDir: tempDir,
      silent: true,
    });

    const binaryFile = result.files.find((f) => f.fileName === "image.png");
    expect(binaryFile).toBeDefined();
    expect(binaryFile!.content).toContain("# image.png");
    expect(binaryFile!.content).toContain("This is a binary file of the type:");
  });

  it("should return file statistics sorted by size with getFileStats", async () => {
    // Create files with different sizes
    await fs.writeFile(path.join(tempDir, "small.txt"), "tiny");
    await fs.writeFile(
      path.join(tempDir, "medium.js"),
      "console.log('medium sized file');",
    );
    await fs.writeFile(
      path.join(tempDir, "large.md"),
      "# Large file\n\nThis is a much larger file with more content to ensure different sizes.\n".repeat(
        10,
      ),
    );

    const result = await getFileStats({
      inputDir: tempDir,
      silent: true,
    });

    expect(result).toHaveProperty("files");
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files.length).toBeGreaterThanOrEqual(3);

    // Check that files are sorted by size (largest first)
    for (let i = 1; i < result.files.length; i++) {
      expect(result.files[i - 1].sizeInBytes).toBeGreaterThanOrEqual(
        result.files[i].sizeInBytes,
      );
    }

    // Check file properties
    const firstFile = result.files[0];
    expect(firstFile).toHaveProperty("path");
    expect(firstFile).toHaveProperty("sizeInBytes");
    expect(firstFile).not.toHaveProperty("gptTokens");
    expect(firstFile).not.toHaveProperty("claudeTokens");

    // Check total token counts
    expect(result).toHaveProperty("totalGptTokens");
    expect(result).toHaveProperty("totalClaudeTokens");
    expect(typeof result.totalGptTokens).toBe("number");
    expect(typeof result.totalClaudeTokens).toBe("number");
    expect(result.totalGptTokens).toBeGreaterThanOrEqual(0);
    expect(result.totalClaudeTokens).toBeGreaterThanOrEqual(0);

    // Snapshot test the actual output
    expect(result).toMatchSnapshot();
  });

  it("should handle binary file mascot.jpg correctly in getFileStats", async () => {
    const result = await getFileStats({
      inputDir: "./test",
      silent: true,
    });

    // Find the mascot.jpg file in results
    const mascotFile = result.files.find((f) => f.path.includes("mascot.jpg"));
    expect(mascotFile).toBeDefined();
    expect(mascotFile!.path).toBe("mascot.jpg");

    // Verify the file size matches processed text content size (56 bytes for "# mascot.jpg\n\nThis is a binary file of the type: Image\n\n")
    expect(mascotFile!.sizeInBytes).toBe(56);

    // Verify that only path and sizeInBytes are present (no token counts per file)
    expect(mascotFile!).toHaveProperty("path");
    expect(mascotFile!).toHaveProperty("sizeInBytes");
    expect(mascotFile!).not.toHaveProperty("gptTokens");
    expect(mascotFile!).not.toHaveProperty("claudeTokens");

    // Verify total token counts include contribution from binary file description
    expect(result.totalGptTokens).toBeGreaterThan(0);
    expect(result.totalClaudeTokens).toBeGreaterThan(0);

    // Verify the file appears in the correct position based on size sorting
    const mascotFileIndex = result.files.findIndex((f) =>
      f.path.includes("mascot.jpg"),
    );
    expect(mascotFileIndex).toBeGreaterThanOrEqual(0);

    // If there are other files, verify sorting (largest first)
    if (result.files.length > 1) {
      for (let i = 1; i < result.files.length; i++) {
        expect(result.files[i - 1].sizeInBytes).toBeGreaterThanOrEqual(
          result.files[i].sizeInBytes,
        );
      }
    }
  });
});
