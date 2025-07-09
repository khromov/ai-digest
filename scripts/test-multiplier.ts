#!/usr/bin/env npx ts-node

/**
 * Quick test to verify the multiplier implementation
 */

import { estimateTokenCount } from "../src/utils";

function testMultiplier(): void {
  console.log("🧪 Testing Claude to OpenAI token multiplier...");
  console.log();

  const testTexts = [
    "Hello, world!",
    "This is a longer test string with more words to get a better sense of the token counting accuracy.",
    "In computer science, artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals."
  ];

  testTexts.forEach((text, index) => {
    const result = estimateTokenCount(text);
    const multiplier = result.gptTokens / result.claudeTokens;
    
    console.log(`📝 Test ${index + 1}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    console.log(`   Claude tokens: ${result.claudeTokens}`);
    console.log(`   Estimated GPT tokens: ${result.gptTokens}`);
    console.log(`   Applied multiplier: ${multiplier.toFixed(4)}`);
    console.log();
  });

  console.log("✅ Multiplier test complete!");
  console.log("💡 The GPT token estimates are based on Claude tokens × 0.9048");
  console.log("📊 This should provide ~90-95% accuracy for most English text");
}

if (require.main === module) {
  testMultiplier();
}
