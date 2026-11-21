import * as simpleIcons from "simple-icons";

export type IconInfo = { slug: string; title: string; hex: string; path: string };

export function normalizeTechName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("+", "plus")
    .replaceAll(".", "dot")
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]/g, "");
}

const ICONS: IconInfo[] = Object.values(simpleIcons).map(({ slug, title, hex, path }) => ({ slug, title, hex, path }));
const BY_SLUG = new Map(ICONS.map((i) => [i.slug, i]));
const BY_NAME = new Map<string, IconInfo>();
for (const icon of ICONS) {
  BY_NAME.set(icon.slug, icon);
  const key = normalizeTechName(icon.title);
  if (!BY_NAME.has(key)) BY_NAME.set(key, icon);
}

/** Common names that differ from simple-icons' names (normalized name → slug) */
const ALIASES: Record<string, string> = {
  golang: "go",
  k8s: "kubernetes",
  postgres: "postgresql",
  node: "nodedotjs",
  nodejs: "nodedotjs",
  js: "javascript",
  ts: "typescript",
  vue: "vuedotjs",
  vuejs: "vuedotjs",
  nextjs: "nextdotjs",
  gcp: "googlecloud",
};

export function iconBySlug(slug: string): IconInfo | null {
  return BY_SLUG.get(slug) ?? null;
}

export function resolveIcon(name: string): IconInfo | null {
  const key = normalizeTechName(name);
  if (!key) return null;
  const alias = ALIASES[key];
  return (alias ? BY_SLUG.get(alias) : undefined) ?? BY_NAME.get(key) ?? null;
}

/** Technologies software engineers commonly use. Shown first among suggestions */
const COMMON = new Set([
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "php",
  "ruby",
  "csharp",
  "react",
  "vuedotjs",
  "angular",
  "nextdotjs",
  "nodedotjs",
  "hono",
  "htmx",
  "docker",
  "kubernetes",
  "postgresql",
  "mysql",
  "sqlite",
  "redis",
  "terraform",
  "githubactions",
  "googlecloud",
  "graphql",
]);

/** Normalized prefix matches first, then substring matches. Within each, common technologies first, then shorter names */
export function suggestIcons(query: string, limit = 8): IconInfo[] {
  const q = normalizeTechName(query);
  if (!q) return [];
  const prefix: IconInfo[] = [];
  const contains: IconInfo[] = [];
  for (const icon of ICONS) {
    const key = normalizeTechName(icon.title);
    if (key.startsWith(q)) prefix.push(icon);
    else if (key.includes(q)) contains.push(icon);
  }
  const byRank = (a: IconInfo, b: IconInfo) =>
    Number(COMMON.has(b.slug)) - Number(COMMON.has(a.slug)) || a.title.length - b.title.length;
  // If an alias matches as a prefix, put that technology first
  const aliased = Object.entries(ALIASES)
    .filter(([alias]) => alias.startsWith(q))
    .map(([, slug]) => BY_SLUG.get(slug))
    .filter((i): i is IconInfo => i !== undefined);
  const ranked = [...aliased, ...prefix.sort(byRank), ...contains.sort(byRank)];
  return [...new Map(ranked.map((i) => [i.slug, i])).values()].slice(0, limit);
}

const escapeXml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function iconSvg(icon: IconInfo): string {
  return `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>${escapeXml(icon.title)}</title><path fill="#${icon.hex}" d="${icon.path}"/></svg>`;
}
