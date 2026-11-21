import type { Lang } from "../src/i18n/lang";
import { type Texts, TranslationError, type Translator } from "../src/translate/ports";

type Call = { texts: Texts; from: Lang; to: Lang };

/** A fake translator for tests. Returns strings prefixed with `[to] ` and records the calls */
export function fakeTranslator(opts: { fail?: boolean } = {}): Translator & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async translate(texts, from, to) {
      calls.push({ texts, from, to });
      if (opts.fail) throw new TranslationError("fake translator failed");
      const out: Texts = {};
      for (const [k, v] of Object.entries(texts)) {
        out[k] = Array.isArray(v) ? v.map((s) => `[${to}] ${s}`) : `[${to}] ${v}`;
      }
      return out;
    },
  };
}
