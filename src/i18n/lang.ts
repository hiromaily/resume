// Decides the resume language (Japanese / English). Pure logic that knows nothing of React or the DB
export type Lang = "ja" | "en";
export const LANGS: readonly Lang[] = ["ja", "en"];
export type Localized<T> = Record<Lang, T>;

/** Language names used on the edit pages (whose UI text is Japanese) */
export const LANG_NAMES: Record<Lang, string> = { ja: "日本語", en: "英語" };

export function isLang(v: unknown): v is Lang {
  return v === "ja" || v === "en";
}

export function otherLang(l: Lang): Lang {
  return l === "ja" ? "en" : "ja";
}

// Sort Accept-Language by q descending and return the first whose primary tag (lowercased) is ja or en
function preferredFromHeader(header: string | undefined): Lang | undefined {
  if (!header) return undefined;
  const items = header.split(",").map((part, index) => {
    const [tag = "", ...params] = part.trim().split(";");
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    return { primary: (tag.trim().split("-")[0] ?? "").toLowerCase(), q: Number.isNaN(q) ? 0 : q, index };
  });
  items.sort((a, b) => b.q - a.q || a.index - b.index);
  return items.find((i) => isLang(i.primary))?.primary as Lang | undefined;
}

export function resolveLang(opts: {
  query: string | undefined;
  acceptLanguage: string | undefined;
  hasName: Record<Lang, boolean>;
}): Lang {
  if (isLang(opts.query)) return opts.query;
  // A resume without an English name is not shown in English, even to viewers who prefer English
  if (preferredFromHeader(opts.acceptLanguage) === "en" && opts.hasName.en) return "en";
  if (opts.hasName.ja) return "ja";
  if (opts.hasName.en) return "en";
  return "ja";
}
