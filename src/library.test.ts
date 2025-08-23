import path from "path";
import fs from "fs/promises";
import os from "os";

// Import the library functions for direct testing
import aiDigest, {
  generateDigest,
  generateDigestFiles,
  generateDigestContent,
  writeDigestToFile,
} from "./index";

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
    expect(file2!.content).toContain("\`\`\`js");
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

    // Verify all functions exclude the same files
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

    // Spec and log files should be excluded by additionalDefaultIgnores
    expect(filesHasSpec).toBe(false);
    expect(filesHasLog).toBe(false);
    expect(contentHasSpec).toBe(false);
    expect(contentHasLog).toBe(false);

    // .env should still be excluded by default ignores
    expect(filesHasEnv).toBe(false);

    // Both functions should return the same number of files
    expect(filesResult.files.length).toBe(contentResult.files.length);

    // Verify app.ts is included in all results
    expect(filesResult.files.some((f) => f.fileName === "app.ts")).toBe(true);
    expect(contentResult.files.some((f) => f.fileName === "app.ts")).toBe(true);
  });
});
