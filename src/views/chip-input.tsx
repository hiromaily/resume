import { resolveIcon, suggestIcons } from "../icons";
import { RemovableChips } from "./removable-chips";
import { TechIcon } from "./resume-view";

/** A field entered as chips. icons controls whether to show technology icon suggestions and chip icons */
export const CHIP_FIELDS = {
  technologies: { icons: true, placeholder: "技術名を入力して候補から選ぶ（カンマ区切りでも可）" },
  skills: { icons: true, placeholder: "スキルを入力して候補から選ぶ（カンマ区切りでも可）" },
  certifications: { icons: false, placeholder: "資格名を入力して候補から追加する（カンマ区切りでも可）" },
  certifications_en: { icons: false, placeholder: "資格名（英語）を入力して候補から追加する（カンマ区切りでも可）" },
} as const;

export type ChipField = keyof typeof CHIP_FIELDS;

export function isChipField(value: string): value is ChipField {
  return Object.hasOwn(CHIP_FIELDS, value);
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Add to the selection (skipping case-insensitive duplicates) / remove from it */
export function applyPick(selected: string[], op: { pick?: string; remove?: string }): string[] {
  const { pick, remove } = op;
  if (remove) return selected.filter((t) => !same(t, remove));
  if (pick && !selected.some((t) => same(t, pick))) return [...selected, pick];
  return selected;
}

const swapAttrs = (field: ChipField) => ({
  "hx-get": `/chips/${field}/pick`,
  "hx-include": "closest .chip-input",
  "hx-target": "closest .chip-input",
  "hx-swap": "outerHTML",
});

const Chip = ({ field, value }: { field: ChipField; value: string }) =>
  CHIP_FIELDS[field].icons ? <TechIcon name={value} /> : <span class="tech tech-text">{value}</span>;

/**
 * Chip input. Selected values are kept in hidden <field> inputs; the text box (<field>_query) is only for typing the next word.
 * Clicking a suggestion or × re-fetches this whole fragment via htmx (no custom JS, since the CSP allows only 'self').
 * Without JS, comma-separated words typed into the box are saved as is
 */
export function ChipInput({
  field,
  selected,
  autofocus = false,
}: {
  field: ChipField;
  selected: string[];
  autofocus?: boolean;
}) {
  return (
    <div class="chip-input">
      <RemovableChips
        name={field}
        values={selected}
        swap={swapAttrs(field)}
        render={(value) => <Chip field={field} value={value} />}
      />
      <input
        id={field}
        name={`${field}_query`}
        value=""
        placeholder={CHIP_FIELDS[field].placeholder}
        autocomplete="off"
        autofocus={autofocus}
        hx-get={`/chips/${field}/suggest`}
        hx-trigger="input changed delay:200ms"
        hx-target="next .suggest"
        hx-swap="outerHTML"
      />
      <ul class="suggest"></ul>
    </div>
  );
}

const PickButton = ({ field, pick, children }: { field: ChipField; pick: string; children: unknown }) => (
  <li>
    <button type="button" hx-vals={JSON.stringify({ pick })} {...swapAttrs(field)}>
      {children}
    </button>
  </li>
);

/** Suggestions for the last word. Also offers the typed word itself so things without icons (AWS, certification names, etc.) can be chosen */
export function ChipSuggestions({ field, query }: { field: ChipField; query: string }) {
  const term = (query.split(",").at(-1) ?? "").trim();
  if (!CHIP_FIELDS[field].icons) {
    return (
      <ul class="suggest">
        {term ? (
          <PickButton field={field} pick={term}>
            ＋ {term} を追加
          </PickButton>
        ) : null}
      </ul>
    );
  }
  const icons = suggestIcons(term);
  const showTerm = term.length > 0 && !resolveIcon(term);
  return (
    <ul class="suggest">
      {showTerm ? (
        <PickButton field={field} pick={term}>
          {term}
        </PickButton>
      ) : null}
      {icons.map((i) => (
        <PickButton field={field} pick={i.title}>
          <img src={`/icons/${i.slug}.svg`} alt="" width="16" height="16" /> {i.title}
        </PickButton>
      ))}
    </ul>
  );
}
