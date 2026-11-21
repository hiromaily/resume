import { createClaudeCliTranslator } from "./claude-cli";
import type { Translator } from "./ports";

/** The only place that picks the translator implementation. To add another, add one line here. Returns null if not configured (translation disabled) */
export function createTranslator(config: { translator: string | undefined }): Translator | null {
  switch (config.translator) {
    case undefined:
      return null;
    case "claude-cli":
      return createClaudeCliTranslator();
    default:
      throw new Error(`Unsupported TRANSLATOR: ${config.translator}`);
  }
}
