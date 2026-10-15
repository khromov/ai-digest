#!/usr/bin/env npx ts-node

import { encoding_for_model } from "tiktoken";
import { countTokens } from "../src/tokenizer";
import { promises as fs } from "fs";
import path from "path";

/**
 * Script to analyze token count ratios between Claude and OpenAI tokenizers
 * using Moby Dick as a large text sample.
 */

async function analyzeTokenRatio(): Promise<void> {
  console.log("🐋 Token Count Analysis: Claude vs OpenAI");
  console.log("=" .repeat(50));

  try {
    const filePath = path.join(__dirname, "moby-dick.txt");
    console.log(`📖 Reading file: ${filePath}`);
    
    const text = await fs.readFile(filePath, "utf-8");
    const textSizeKB = Buffer.byteLength(text) / 1024;
    const textSizeMB = textSizeKB / 1024;
    
    console.log(`📏 File size: ${textSizeKB.toFixed(1)} KB (${textSizeMB.toFixed(2)} MB)`);
    console.log(`📝 Character count: ${text.length.toLocaleString()}`);
    console.log();

    console.log("🤖 Tokenizing with Claude tokenizer...");
    const startClaude = Date.now();
    const claudeTokens = countTokens(text);
    const claudeTime = Date.now() - startClaude;
    console.log(`✅ Claude tokens: ${claudeTokens.toLocaleString()} (${claudeTime}ms)`);

    console.log("🤖 Tokenizing with OpenAI tokenizer (GPT-4o)...");
    let enc: ReturnType<typeof encoding_for_model> | null = null;
    let openaiTokens = 0;
    let openaiTime = 0;

    try {
      enc = encoding_for_model("gpt-4o");
      const startOpenAI = Date.now();
      const encoded = enc.encode(text);
      openaiTokens = encoded.length;
      openaiTime = Date.now() - startOpenAI;
      console.log(`✅ OpenAI tokens: ${openaiTokens.toLocaleString()} (${openaiTime}ms)`);
    } finally {
      if (enc) {
        enc.free();
      }
    }

    console.log();
    console.log("📊 Analysis Results:");
    console.log("=" .repeat(30));

    const claudeToOpenAIRatio = claudeTokens / openaiTokens;
    const openAIToClaudeRatio = openaiTokens / claudeTokens;

    console.log(`🔢 Claude tokens: ${claudeTokens.toLocaleString()}`);
    console.log(`🔢 OpenAI tokens: ${openaiTokens.toLocaleString()}`);
    console.log();
    console.log(`📈 Claude to OpenAI ratio: ${claudeToOpenAIRatio.toFixed(4)}`);
    console.log(`📈 OpenAI to Claude ratio: ${openAIToClaudeRatio.toFixed(4)}`);
    console.log();

    console.log("💡 Recommendations:");
    console.log("-".repeat(20));
    
    if (claudeToOpenAIRatio > 1) {
      console.log(`📋 Claude typically produces ${((claudeToOpenAIRatio - 1) * 100).toFixed(1)}% more tokens than OpenAI`);
      console.log(`🧮 To estimate OpenAI tokens from Claude: claudeTokens × ${openAIToClaudeRatio.toFixed(4)}`);
    } else {
      console.log(`📋 OpenAI typically produces ${((openAIToClaudeRatio - 1) * 100).toFixed(1)}% more tokens than Claude`);
      console.log(`🧮 To estimate OpenAI tokens from Claude: claudeTokens × ${openAIToClaudeRatio.toFixed(4)}`);
    }

    console.log();
    console.log("⚡ Performance Comparison:");
    console.log(`🤖 Claude tokenization: ${claudeTime}ms`);
    console.log(`🤖 OpenAI tokenization: ${openaiTime}ms`);
    
    if (claudeTime < openaiTime) {
      console.log(`✅ Claude is ${((openaiTime / claudeTime - 1) * 100).toFixed(1)}% faster`);
    } else {
      console.log(`✅ OpenAI is ${((claudeTime / openaiTime - 1) * 100).toFixed(1)}% faster`);
    }

    console.log();
    console.log("🔧 Suggested Implementation:");
    console.log("-".repeat(30));
    console.log("```typescript");
    console.log("function estimateOpenAITokensFromClaude(claudeTokens: number): number {");
    console.log(`  return Math.round(claudeTokens * ${openAIToClaudeRatio.toFixed(4)});`);
    console.log("}");
    console.log("```");

    console.log();
    console.log("📈 Accuracy Note:");
    console.log("This multiplier is based on Moby Dick and should be reasonably");
    console.log("accurate for most English text. Results may vary for code,");
    console.log("non-English text, or highly technical content.");

  } catch (error) {
    console.error("❌ Error during analysis:", error);
    process.exit(1);
  }
}

async function testMultiplierAccuracy(): Promise<void> {
  console.log();
  console.log("🧪 Testing Multiplier Accuracy with Sample Texts");
  console.log("=" .repeat(50));

  const testTexts = [
    "Hello, world! This is a simple test.",
    "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the alphabet at least once.",
    "In computer science, artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals.",
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
  ];

  const mobyDickPath = path.join(__dirname, "moby-dick.txt");
  const fullText = await fs.readFile(mobyDickPath, "utf-8");
  const sampleText = fullText.substring(0, 10000);
  
  const claudeTokensSample = countTokens(sampleText);
  let openaiTokensSample = 0;
  let enc: ReturnType<typeof encoding_for_model> | null = null;
  
  try {
    enc = encoding_for_model("gpt-4o");
    openaiTokensSample = enc.encode(sampleText).length;
  } finally {
    if (enc) {
      enc.free();
    }
  }
  
  const multiplier = openaiTokensSample / claudeTokensSample;
  console.log(`🔢 Calculated multiplier from sample: ${multiplier.toFixed(4)}`);
  console.log();

  for (let i = 0; i < testTexts.length; i++) {
    const text = testTexts[i];
    console.log(`📝 Test ${i + 1}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const claudeTokens = countTokens(text);
    
    let actualOpenAITokens = 0;
    let enc2: ReturnType<typeof encoding_for_model> | null = null;
    
    try {
      enc2 = encoding_for_model("gpt-4o");
      actualOpenAITokens = enc2.encode(text).length;
    } finally {
      if (enc2) {
        enc2.free();
      }
    }
    
    const estimatedOpenAITokens = Math.round(claudeTokens * multiplier);
    const accuracy = 100 - Math.abs((estimatedOpenAITokens - actualOpenAITokens) / actualOpenAITokens * 100);
    
    console.log(`   Claude: ${claudeTokens}, Actual OpenAI: ${actualOpenAITokens}, Estimated: ${estimatedOpenAITokens}`);
    console.log(`   Accuracy: ${accuracy.toFixed(1)}%`);
    console.log();
  }
}

async function main(): Promise<void> {
  await analyzeTokenRatio();
  await testMultiplierAccuracy();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}
