/** The list of positions. Groups are used for the dropdown headings and badge colors */
export const POSITION_GROUPS = [
  {
    key: "engineer",
    label: "エンジニア",
    positions: [
      "Engineer",
      "Frontend Engineer",
      "Backend Engineer",
      "Full-stack Engineer",
      "Mobile Engineer",
      "Embedded Engineer",
    ],
  },
  {
    key: "platform",
    label: "基盤・運用",
    positions: ["Infrastructure Engineer", "SRE", "DevOps Engineer", "Security Engineer"],
  },
  { key: "data", label: "データ", positions: ["Data Engineer", "ML Engineer", "Data Scientist"] },
  { key: "quality", label: "品質", positions: ["QA"] },
  {
    key: "lead",
    label: "技術のリード",
    positions: ["Tech Lead", "Lead Engineer", "Staff Engineer", "Principal Engineer", "Architect"],
  },
  { key: "management", label: "マネジメント", positions: ["EM", "VPoE", "CTO"] },
  { key: "product", label: "プロダクト", positions: ["PdM", "PM", "Scrum Master"] },
  { key: "design", label: "デザイン", positions: ["Designer"] },
] as const;

export type Position = (typeof POSITION_GROUPS)[number]["positions"][number];

export const POSITIONS: readonly Position[] = POSITION_GROUPS.flatMap((g) => g.positions);

export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}

/** Badge color classes (per group) */
export function positionClass(p: Position): string {
  const group = POSITION_GROUPS.find((g) => (g.positions as readonly string[]).includes(p));
  return `pos-${group?.key ?? "engineer"}`;
}

/** Drops duplicates and values not in the list, keeping the order they were chosen in */
export function normalizePositions(values: string[]): Position[] {
  return [...new Set(values)].filter(isPosition);
}
