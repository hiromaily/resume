import type { Lang } from "../i18n/lang";

/** The text to translate. Each key holds a string or an array of strings */
export type Texts = Record<string, string | string[]>;

export interface Translator {
  /** Returns the same keys and types as the input (a string for a string, an array of the same length for an array) */
  translate(texts: Texts, from: Lang, to: Lang): Promise<Texts>;
}

/** Provider failures, timeouts and malformed results all become this error */
export class TranslationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TranslationError";
  }
}

/** Checks that the translation result has the same shape as the input. Every implementation returns through this */
export function assertSameShape(input: Texts, output: unknown): Texts {
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    throw new TranslationError("Translation result is not an object");
  }
  const out = output as Record<string, unknown>;
  const inputKeys = Object.keys(input);
  const outputKeys = Object.keys(out);
  if (inputKeys.length !== outputKeys.length || inputKeys.some((k) => !Object.hasOwn(out, k))) {
    throw new TranslationError("Translation result has different keys");
  }
  for (const key of inputKeys) {
    const want = input[key];
    const got = out[key];
    if (Array.isArray(want)) {
      if (!Array.isArray(got) || got.length !== want.length || got.some((v) => typeof v !== "string")) {
        throw new TranslationError(`Translation result for "${key}" is not a string array of the same length`);
      }
    } else if (typeof got !== "string") {
      throw new TranslationError(`Translation result for "${key}" is not a string`);
    }
  }
  return out as Texts;
}
