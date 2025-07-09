#!/usr/bin/env npx ts-node

/**
 * Simple script to calculate the Claude to OpenAI token multiplier
 * Run this whenever you want to recalculate the multiplier with different text samples
 */

import { encoding_for_model } from "tiktoken";
import { countTokens } from "@anthropic-ai/tokenizer";
import { promises as fs } from "fs";
import path from "path";

async function calculateMultiplier(): Promise<number> {
  try {
    const filePath = path.join(__dirname, "moby-dick.txt");
    const text = await fs.readFile(filePath, "utf-8");
    const sampleText = text.substring(0, 50000);
    
    console.log("🔢 Calculating Claude to OpenAI token multiplier...");
    console.log(`📏 Using sample of ${sampleText.length} characters`);
    
    const claudeTokens = countTokens(sampleText);
    
    let enc: ReturnType<typeof encoding_for_model> | null = null;
    let openaiTokens = 0;
    
    try {
      enc = encoding_for_model("gpt-4o");
      openaiTokens = enc.encode(sampleText).length;
    } finally {
      if (enc) {
        enc.free();
      }
    }
    
    const multiplier = openaiTokens / claudeTokens;
    
    console.log(`🤖 Claude tokens: ${claudeTokens}`);
    console.log(`🤖 OpenAI tokens: ${openaiTokens}`);
    console.log(`📈 Multiplier (OpenAI/Claude): ${multiplier.toFixed(4)}`);
    
    return multiplier;
  } catch (error) {
    console.error("❌ Error calculating multiplier:", error);
    return 0.9048; // fallback to our calculated value
  }
}

export const CLAUDE_TO_OPENAI_MULTIPLIER = 0.9048;

if (require.main === module) {
  calculateMultiplier().then((multiplier) => {
    console.log();
    console.log("✅ Calculation complete!");
    console.log(`💡 Use this value in your code: ${multiplier.toFixed(4)}`);
  });
}
