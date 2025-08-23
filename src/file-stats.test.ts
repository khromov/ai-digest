import path from "path";
import fs from "fs/promises";
import os from "os";

// Import the library functions for direct testing
import { getFileStats } from "./index";

describe("AI Digest File Stats API", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-digest-stats-test-"));

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

  it("should apply additionalDefaultIgnores in getFileStats", async () => {
    // Create test files with specific patterns
    await fs.writeFile(path.join(tempDir, "app.ts"), "const app = 'main';");
    await fs.writeFile(
      path.join(tempDir, "app.spec.ts"),
      "describe('app', () => {});"
    );
    await fs.writeFile(path.join(tempDir, "temp.log"), "log entries");
    await fs.writeFile(path.join(tempDir, ".env"), "SECRET=value");

    const additionalIgnores = ["*.spec.ts", "*.log"];

    // Test getFileStats
    const statsResult = await getFileStats({
      inputDir: tempDir,
      additionalDefaultIgnores: additionalIgnores,
      silent: true,
    });

    const statsHasSpec = statsResult.files.some((f) =>
      f.path.endsWith(".spec.ts")
    );
    const statsHasLog = statsResult.files.some((f) => f.path.endsWith(".log"));

    // Spec and log files should be excluded by additionalDefaultIgnores
    expect(statsHasSpec).toBe(false);
    expect(statsHasLog).toBe(false);

    // Verify app.ts is included in results
    expect(statsResult.files.some((f) => f.path === "app.ts")).toBe(true);
  });
});
