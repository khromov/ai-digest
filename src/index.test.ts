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
  MinifyFileDescriptionCallback,
} from "./index";

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

  // New tests for minify functionality
  it("should respect .aidigestminify file", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-minify-test-")
    );

    try {
      // Create test files
      await fs.writeFile(
        path.join(tempDir, "regular.js"),
        "console.log(\"Regular file\");"
      );
      await fs.writeFile(
        path.join(tempDir, "minified.min.js"),
        "function min(){console.log(\"minified\")}"
      );
      await fs.writeFile(path.join(tempDir, "data.json"), "{\"key\": \"value\"}");

      // Create .aidigestminify file
      await fs.writeFile(
        path.join(tempDir, ".aidigestminify"),
        "*.min.js\n*.json"
      );

      // Run the CLI
      const { stdout } = await runCLI(`--input ${tempDir}`);

      // Check output mentions minified files
      expect(stdout).toContain("Files minified by .aidigestminify:");
      expect(stdout).toContain("Minify patterns from .aidigestminify:");
      expect(stdout).toContain("  - *.min.js");
      expect(stdout).toContain("  - *.json");

      // Read the generated file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, "utf-8");

      // Regular file should have full content
      expect(content).toContain("# regular.js");
      expect(content).toContain("console.log(\"Regular file\");");

      // Minified files should have placeholder content
      expect(content).toContain("# minified.min.js");
      expect(content).toContain("This is a minified file of type: JS");
      expect(content).toContain(
        "(File exists but content excluded via .aidigestminify)"
      );
      expect(content).not.toContain("function min(){console.log(\"minified\")}");

      expect(content).toContain("# data.json");
      expect(content).toContain("This is a minified file of type: JSON");
      expect(content).not.toContain("{\"key\": \"value\"}");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("should respect custom minify file with --minify-file flag", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-custom-minify-test-")
    );

    try {
      // Create test files
      await fs.writeFile(
        path.join(tempDir, "regular.js"),
        "console.log(\"Regular\");"
      );
      await fs.writeFile(
        path.join(tempDir, "exclude.txt"),
        "Should be minified"
      );

      // Create custom minify file
      await fs.writeFile(path.join(tempDir, "custom.minify"), "*.txt");

      // Run the CLI with custom minify file
      const { stdout } = await runCLI(
        `--input ${tempDir} --minify-file custom.minify`
      );

      // Check output
      expect(stdout).toContain("Minify patterns from custom.minify:");
      expect(stdout).toContain("  - *.txt");

      // Read the generated file
      const codebasePath = path.resolve(process.cwd(), "codebase.md");
      const content = await fs.readFile(codebasePath, "utf-8");

      // Regular JS should have full content
      expect(content).toContain("console.log(\"Regular\");");

      // TXT file should be minified
      expect(content).toContain("# exclude.txt");
      expect(content).toContain("This is a minified file of type: TXT");
      expect(content).not.toContain("Should be minified");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
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
      "console.log(\"Test content 2\");"
    );

    // Create a subdirectory with a file
    const subDir = path.join(tempDir, "subdir");
    await fs.mkdir(subDir);
    await fs.writeFile(
      path.join(subDir, "file3.py"),
      "print(\"Test content 3\")"
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
    expect(content).toContain("console.log(\"Test content 2\");");
    expect(content).toContain("# subdir/file3.py");
    expect(content).toContain("print(\"Test content 3\")");
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
      "function test() {\n    console.log(\"multiple    spaces\");\n\n\n}"
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
      "function test() { console.log(\"multiple spaces\"); }"
    );
    // Without whitespace removal, the original spacing should be preserved
    expect(contentWithoutRemoval).toContain(
      "function test() {\n    console.log(\"multiple    spaces\");\n\n\n}"
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
      expect.stringContaining("Files aggregated successfully")
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
    expect(file1!.content).toContain("\`\`\`txt");
    expect(file1!.content).toContain("Test content 1");
    expect(file1!.content).toMatch(/\`\`\`\n\n$/);

    const file2 = result.files.find((f) => f.fileName === "file2.js");
    expect(file2).toBeDefined();
    expect(file2!.content).toContain("# file2.js");
    expect(file2!.content).toContain("```js");
    expect(file2!.content).toContain("console.log(\"Test content 2\");");
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
      "function test() {\n    console.log(\"multiple    spaces\");\n\n\n}"
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
      (f) => f.fileName === "whitespace.js"
    );
    const whitespaceFileWithoutRemoval = resultWithoutRemoval.files.find(
      (f) => f.fileName === "whitespace.js"
    );

    expect(whitespaceFileWithRemoval!.content).toContain(
      "function test() { console.log(\"multiple spaces\"); }"
    );
    expect(whitespaceFileWithoutRemoval!.content).toContain(
      "function test() {\n    console.log(\"multiple    spaces\");\n\n\n}"
    );
  });

  it("should work with multiple input directories in generateDigestFiles", async () => {
    // Create another temp directory
    const tempDir2 = await fs.mkdtemp(
      path.join(os.tmpdir(), "ai-digest-test2-")
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
      "console.log('medium sized file');"
    );
    await fs.writeFile(
      path.join(tempDir, "large.md"),
      "# Large file\n\nThis is a much larger file with more content to ensure different sizes.\n".repeat(
        10
      )
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
        result.files[i].sizeInBytes
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
      f.path.includes("mascot.jpg")
    );
    expect(mascotFileIndex).toBeGreaterThanOrEqual(0);

    // If there are other files, verify sorting (largest first)
    if (result.files.length > 1) {
      for (let i = 1; i < result.files.length; i++) {
        expect(result.files[i - 1].sizeInBytes).toBeGreaterThanOrEqual(
          result.files[i].sizeInBytes
        );
      }
    }
  });

  it("should respect additionalDefaultIgnores option", async () => {
    // Create test files including a test file and a config file
    await fs.writeFile(path.join(tempDir, "main.ts"), "const main = () => {};");
    await fs.writeFile(
      path.join(tempDir, "main.test.ts"),
      "test('main', () => {});"
    );
    await fs.writeFile(path.join(tempDir, "config.json"), "{\"key\": \"value\"}");

    // First, get files without additional ignores
    const withoutIgnores = await generateDigestFiles({
      inputDir: tempDir,
      silent: true,
    });

    // Then get files with additionalDefaultIgnores
    const withIgnores = await generateDigestFiles({
      inputDir: tempDir,
      additionalDefaultIgnores: ["*.test.ts", "*.json"],
      silent: true,
    });

    // Verify the test file and config file are excluded
    const hasTestFile = withIgnores.files.some((f) =>
      f.fileName.endsWith(".test.ts")
    );
    const hasJsonFile = withIgnores.files.some((f) =>
      f.fileName.endsWith(".json")
    );
    const hasMainFile = withIgnores.files.some((f) => f.fileName === "main.ts");

    expect(hasTestFile).toBe(false);
    expect(hasJsonFile).toBe(false);
    expect(hasMainFile).toBe(true);

    // Verify the file count decreased
    expect(withIgnores.files.length).toBeLessThan(withoutIgnores.files.length);
  });

  it("should apply additionalDefaultIgnores across all three main functions", async () => {
    // Create test files with specific patterns
    await fs.writeFile(path.join(tempDir, "app.ts"), "const app = 'main';");
    await fs.writeFile(
      path.join(tempDir, "app.spec.ts"),
      "describe('app', () => {});"
    );
    await fs.writeFile(path.join(tempDir, "temp.log"), "log entries");
    await fs.writeFile(path.join(tempDir, ".env"), "SECRET=value");

    const additionalIgnores = ["*.spec.ts", "*.log"];

    // Test generateDigestFiles
    const filesResult = await generateDigestFiles({
      inputDir: tempDir,
      additionalDefaultIgnores: additionalIgnores,
      silent: true,
    });

    // Test generateDigestContent
    const contentResult = await generateDigestContent({
      inputDir: tempDir,
      additionalDefaultIgnores: additionalIgnores,
      silent: true,
    });

    // Test getFileStats
    const statsResult = await getFileStats({
      inputDir: tempDir,
      additionalDefaultIgnores: additionalIgnores,
      silent: true,
    });

    // Verify all three functions exclude the same files
    const filesHasSpec = filesResult.files.some((f) =>
      f.fileName.endsWith(".spec.ts")
    );
    const filesHasLog = filesResult.files.some((f) =>
      f.fileName.endsWith(".log")
    );
    const filesHasEnv = filesResult.files.some((f) => f.fileName === ".env");

    const contentHasSpec = contentResult.files.some((f) =>
      f.fileName.endsWith(".spec.ts")
    );
    const contentHasLog = contentResult.files.some((f) =>
      f.fileName.endsWith(".log")
    );

    const statsHasSpec = statsResult.files.some((f) =>
      f.path.endsWith(".spec.ts")
    );
    const statsHasLog = statsResult.files.some((f) => f.path.endsWith(".log"));

    // Spec and log files should be excluded by additionalDefaultIgnores
    expect(filesHasSpec).toBe(false);
    expect(filesHasLog).toBe(false);
    expect(contentHasSpec).toBe(false);
    expect(contentHasLog).toBe(false);
    expect(statsHasSpec).toBe(false);
    expect(statsHasLog).toBe(false);

    // .env should still be excluded by default ignores
    expect(filesHasEnv).toBe(false);

    // All three functions should return the same number of files
    expect(filesResult.files.length).toBe(contentResult.files.length);
    expect(filesResult.files.length).toBe(statsResult.files.length);

    // Verify app.ts is included in all results
    expect(filesResult.files.some((f) => f.fileName === "app.ts")).toBe(true);
    expect(contentResult.files.some((f) => f.fileName === "app.ts")).toBe(true);
    expect(statsResult.files.some((f) => f.path === "app.ts")).toBe(true);
  });

  // New tests for minify functionality in library mode
  it("should respect minify patterns with generateDigest", async () => {
    // Create test files
    await fs.writeFile(
      path.join(tempDir, "regular.js"),
      "console.log(\"Regular\");"
    );
    await fs.writeFile(
      path.join(tempDir, "minified.min.js"),
      "function min(){console.log(\"min\")}"
    );

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.js");

    const content = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      minifyFile: ".aidigestminify",
      silent: true,
    });

    // Regular file should have full content
    expect(content).toContain("# regular.js");
    expect(content).toContain("console.log(\"Regular\");");

    // Minified file should have placeholder
    expect(content).toContain("# minified.min.js");
    expect(content).toContain("This is a minified file of type: JS");
    expect(content).toContain(
      "(File exists but content excluded via .aidigestminify)"
    );
    expect(content).not.toContain("function min(){console.log(\"min\")}");
  });

  it("should respect minify patterns with generateDigestFiles", async () => {
    // Create test files
    await fs.writeFile(path.join(tempDir, "data.json"), "{\"key\": \"value\"}");

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.json");

    const result = await generateDigestFiles({
      inputDir: tempDir,
      minifyFile: ".aidigestminify",
      silent: true,
    });

    const jsonFile = result.files.find((f) => f.fileName === "data.json");
    expect(jsonFile).toBeDefined();
    expect(jsonFile!.content).toContain(
      "This is a minified file of type: JSON"
    );
    expect(jsonFile!.content).not.toContain("{\"key\": \"value\"}");
  });

  it("should include minified count in generateDigestContent stats", async () => {
    // Create test files
    await fs.writeFile(path.join(tempDir, "regular.txt"), "Regular content");
    await fs.writeFile(path.join(tempDir, "minified1.min.js"), "minified JS");
    await fs.writeFile(path.join(tempDir, "minified2.min.css"), "minified CSS");

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.*");

    const { stats } = await generateDigestContent({
      inputDir: tempDir,
      minifyFile: ".aidigestminify",
      silent: true,
    });

    expect(stats.minifiedCount).toBe(2);
    expect(stats.includedCount).toBe(6); // 3 original + 3 from beforeEach
  });

  it("should handle minified files in getFileStats", async () => {
    // Create test files
    await fs.writeFile(
      path.join(tempDir, "large.js"),
      "console.log('This is a large file with lots of content');".repeat(10)
    );
    await fs.writeFile(
      path.join(tempDir, "minified.min.js"),
      "function veryLongMinifiedContentThatWouldNormallyBeLarge(){}" +
        "x".repeat(1000)
    );

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.js");

    const result = await getFileStats({
      inputDir: tempDir,
      minifyFile: ".aidigestminify",
      silent: true,
    });

    const minFile = result.files.find((f) => f.path === "minified.min.js");
    expect(minFile).toBeDefined();

    // The size should be the placeholder size, not the original file size
    // Placeholder is: "# minified.min.js\n\nThis is a minified file of type: JS\n(File exists but content excluded via .aidigestminify)\n\n"
    expect(minFile!.sizeInBytes).toBeLessThan(200); // Should be much smaller than original
  });

  it("should use custom minify file location", async () => {
    // Create a custom directory for config
    const configDir = path.join(tempDir, "config");
    await fs.mkdir(configDir);

    // Create test files
    await fs.writeFile(
      path.join(tempDir, "data.csv"),
      "id,name\n1,John\n2,Jane"
    );

    // Create custom minify file in config directory
    await fs.writeFile(path.join(configDir, "custom.minify"), "*.csv");

    const content = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      minifyFile: "config/custom.minify",
      silent: true,
    });

    // CSV file should be minified
    expect(content).toContain("# data.csv");
    expect(content).toContain("This is a minified file of type: CSV");
    expect(content).not.toContain("id,name");
  });

  // New tests for minifyFileDescription callback
  it("should use minifyFileDescription callback when provided", async () => {
    // Create test files
    await fs.writeFile(
      path.join(tempDir, "app.min.js"),
      "function app(){console.log(\"app\")}"
    );
    await fs.writeFile(path.join(tempDir, "styles.min.css"), ".btn{color:red}");

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.*");

    // Define custom callback
    const customCallback: MinifyFileDescriptionCallback = (metadata) => {
      return (
        `# ${metadata.displayPath}\n\n` +
        `Custom minified content for ${metadata.extension.toUpperCase()} file\n` +
        `File type: ${metadata.fileType}\n` +
        "This file was minified and excluded.\n\n"
      );
    };

    const content = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      minifyFile: ".aidigestminify",
      minifyFileDescription: customCallback,
      silent: true,
    });

    // Check that custom callback was used
    expect(content).toContain("Custom minified content for JS file");
    expect(content).toContain("Custom minified content for CSS file");
    expect(content).toContain("This file was minified and excluded");

    // Original default text should not be present
    expect(content).not.toContain(
      "(File exists but content excluded via .aidigestminify)"
    );
  });

  it("should pass correct metadata to minifyFileDescription callback", async () => {
    // Create test file
    await fs.writeFile(
      path.join(tempDir, "bundle.min.js"),
      "function bundle(){}"
    );

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.js");

    let capturedMetadata: {
      filePath: string;
      displayPath: string;
      extension: string;
      fileType: string;
      defaultText: string;
    } | null = null;

    // Define callback that captures metadata
    const captureCallback: MinifyFileDescriptionCallback = (metadata) => {
      capturedMetadata = metadata;
      return metadata.defaultText; // Return default text
    };

    await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      minifyFile: ".aidigestminify",
      minifyFileDescription: captureCallback,
      silent: true,
    });

    // Verify metadata was captured and has correct properties
    expect(capturedMetadata).not.toBeNull();
    expect(capturedMetadata!.displayPath).toBe("bundle.min.js");
    expect(capturedMetadata!.extension).toBe("js");
    expect(capturedMetadata!.fileType).toBeDefined();
    expect(capturedMetadata!.filePath).toContain("bundle.min.js");
    expect(capturedMetadata!.defaultText).toContain(
      "This is a minified file of type: JS"
    );
  });

  it("should work with minifyFileDescription in generateDigestFiles", async () => {
    // Create test files
    await fs.writeFile(
      path.join(tempDir, "lib.min.js"),
      "var lib=function(){}"
    );

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.js");

    // Define custom callback
    const customCallback: MinifyFileDescriptionCallback = (metadata) => {
      return `# ${metadata.displayPath}\n\nMinified: ${metadata.extension}\n\n`;
    };

    const result = await generateDigestFiles({
      inputDir: tempDir,
      minifyFile: ".aidigestminify",
      minifyFileDescription: customCallback,
      silent: true,
    });

    const minFile = result.files.find((f) => f.fileName === "lib.min.js");
    expect(minFile).toBeDefined();
    expect(minFile!.content).toBe("# lib.min.js\n\nMinified: js\n\n");
  });

  it("should work with minifyFileDescription in generateDigestContent", async () => {
    // Create test files
    await fs.writeFile(path.join(tempDir, "vendor.min.js"), "var vendor={}");

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.js");

    // Define custom callback
    const customCallback: MinifyFileDescriptionCallback = (_metadata) => {
      return "Custom minified content\n\n";
    };

    const { content, stats } = await generateDigestContent({
      inputDir: tempDir,
      minifyFile: ".aidigestminify",
      minifyFileDescription: customCallback,
      silent: true,
    });

    expect(content).toContain("Custom minified content");
    expect(stats.minifiedCount).toBe(1);
  });

  it("should work with minifyFileDescription in getFileStats", async () => {
    // Create test files
    await fs.writeFile(
      path.join(tempDir, "dist.min.js"),
      "x".repeat(10000) // Large minified file
    );

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.js");

    // Define custom callback that returns a longer message
    const customCallback: MinifyFileDescriptionCallback = (metadata) => {
      return (
        `# ${metadata.displayPath}\n\n` +
        "This is a much longer custom message for minified files.\n" +
        "It contains more text than the default message to test size calculation.\n" +
        `File extension: ${metadata.extension}\n` +
        `File type: ${metadata.fileType}\n\n`
      );
    };

    const result = await getFileStats({
      inputDir: tempDir,
      minifyFile: ".aidigestminify",
      minifyFileDescription: customCallback,
      silent: true,
    });

    const minFile = result.files.find((f) => f.path === "dist.min.js");
    expect(minFile).toBeDefined();

    // The size should reflect the custom callback's output
    // Should be larger than default placeholder but still much smaller than original
    expect(minFile!.sizeInBytes).toBeGreaterThan(100); // Custom message is longer
    expect(minFile!.sizeInBytes).toBeLessThan(500); // But still much smaller than 10000
  });

  it("should allow returning the default text from minifyFileDescription", async () => {
    // Create test file
    await fs.writeFile(path.join(tempDir, "app.min.js"), "function(){}");

    // Create .aidigestminify file
    await fs.writeFile(path.join(tempDir, ".aidigestminify"), "*.min.js");

    // Define callback that modifies and returns the default text
    const modifyCallback: MinifyFileDescriptionCallback = (metadata) => {
      return (
        metadata.defaultText + "Additional note: This file was processed.\n"
      );
    };

    const content = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      minifyFile: ".aidigestminify",
      minifyFileDescription: modifyCallback,
      silent: true,
    });

    // Should contain both default text and additional note
    expect(content).toContain(
      "(File exists but content excluded via .aidigestminify)"
    );
    expect(content).toContain("Additional note: This file was processed");
  });

  it("should handle multiple file types with minifyFileDescription", async () => {
    // Create test files of different types
    await fs.writeFile(path.join(tempDir, "app.min.js"), "js content");
    await fs.writeFile(path.join(tempDir, "styles.min.css"), "css content");
    await fs.writeFile(path.join(tempDir, "data.json"), "{}");

    // Create .aidigestminify file
    await fs.writeFile(
      path.join(tempDir, ".aidigestminify"),
      "*.min.*\n*.json"
    );

    // Define callback that handles different file types differently
    const typeCallback: MinifyFileDescriptionCallback = (metadata) => {
      switch (metadata.extension) {
      case "js":
        return `# ${metadata.displayPath}\n\nJavaScript bundle (minified)\n\n`;
      case "css":
        return `# ${metadata.displayPath}\n\nCSS bundle (minified)\n\n`;
      case "json":
        return `# ${metadata.displayPath}\n\nJSON data file (excluded)\n\n`;
      default:
        return metadata.defaultText;
      }
    };

    const content = await generateDigest({
      inputDir: tempDir,
      outputFile: null,
      minifyFile: ".aidigestminify",
      minifyFileDescription: typeCallback,
      silent: true,
    });

    // Check that each file type got its custom message
    expect(content).toContain("JavaScript bundle (minified)");
    expect(content).toContain("CSS bundle (minified)");
    expect(content).toContain("JSON data file (excluded)");
  });
});
