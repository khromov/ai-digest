import fs from "fs";
import path from "path";
import { Tiktoken } from "tiktoken/lite";

// Claude BPE vocabulary vendored unmodified from @anthropic-ai/tokenizer@0.0.4
// (see vendor/anthropic-tokenizer/README.md). Resolved relative to this file so
// it works from both src/ (ts-node, ts-jest) and dist/ (published package).
const CLAUDE_VOCABULARY_PATH = path.join(
  __dirname,
  "..",
  "vendor",
  "anthropic-tokenizer",
  "claude.json",
);

interface ClaudeVocabulary {
  bpe_ranks: string;
  special_tokens: Record<string, number>;
  pat_str: string;
}

let claudeTokenizer: Tiktoken | null = null;

// The encoder is created lazily once and reused for the lifetime of the process,
// instead of re-parsing the ~700 KB vocabulary on every call.
function getClaudeTokenizer(): Tiktoken {
  if (!claudeTokenizer) {
    const vocabulary = JSON.parse(
      fs.readFileSync(CLAUDE_VOCABULARY_PATH, "utf-8"),
    ) as ClaudeVocabulary;
    claudeTokenizer = new Tiktoken(
      vocabulary.bpe_ranks,
      vocabulary.special_tokens,
      vocabulary.pat_str,
    );
  }
  return claudeTokenizer;
}

// Same behaviour as countTokens from @anthropic-ai/tokenizer@0.0.4:
// NFKC-normalize, then encode with all special tokens allowed.
export function countTokens(text: string): number {
  return getClaudeTokenizer().encode(text.normalize("NFKC"), "all").length;
}
