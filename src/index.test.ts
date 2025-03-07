import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Import the library functions for direct testing
import aiDigest, {
  generateDigest,
  generateDigestContent,
  writeDigestToFile,
} from "./index";

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
        'console.log("Test content 2");'
      );

      // Create a subdirectory with a file
      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir);
      await fs.writeFile(
        path.join(subDir, "test3.py"),
        'print("Test content 3")'
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
      'console.log("Test content 2");'
    );

    // Create a subdirectory with a file
    const subDir = path.join(tempDir, "subdir");
    await fs.mkdir(subDir);
    await fs.writeFile(
      path.join(subDir, "file3.py"),
      'print("Test content 3")'
    );
  });

  afterEach(async () => {
    // Clean up temporary directory after each test
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should be importable as a module", () => {
    expect(aiDigest).toBeDefined();
    expect(generateDigest).toBeDefined();
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
      'function test() {\n    console.log("multiple    spaces");\n\n\n}'
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
      'function test() { console.log("multiple spaces"); }'
    );
    // Without whitespace removal, the original spacing should be preserved
    expect(contentWithoutRemoval).toContain(
      'function test() {\n    console.log("multiple    spaces");\n\n\n}'
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
});
