import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Import the library functions for direct testing
import {
  generateDigest,
  generateDigestFiles,
  generateDigestContent,
  getFileStats,
  MinifyFileDescriptionCallback,
} from "./index";

const execAsync = promisify(exec);

const runCLI = async (args: string = "") => {
  const cliPath = path.resolve(__dirname, "index.ts");
  return execAsync(`ts-node ${cliPath} ${args}`);
};

describe("AI Digest Minify Functionality", () => {
  afterAll(async () => {
    // Remove the created .md files after all tests complete
    await fs
      .unlink(path.resolve(__dirname, "..", "codebase.md"))
      .catch(() => {});
  });

  // CLI minify tests
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

  // Library minify tests
  describe("Library Minify Functionality", () => {
    let tempDir: string;

    beforeEach(async () => {
      // Create a temporary directory for each test
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-digest-minify-lib-test-"));

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

    // Tests for minifyFileDescription callback
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
});
