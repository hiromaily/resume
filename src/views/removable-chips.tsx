import type { Child } from "hono/jsx";

/**
 * Chips for the selected values. Values are sent in hidden <name> inputs; × re-fetches the whole input fragment via htmx attributes (swap), with { remove: value }.
 * Used by the chip input (chip-input.tsx) and the position input (position-input.tsx)
 */
export function RemovableChips<T extends string>({
  name,
  values,
  swap,
  render,
}: {
  name: string;
  values: readonly T[];
  swap: Record<string, string>;
  render: (value: T) => Child;
}) {
  return (
    <ul class="chips">
      {values.map((value) => (
        <li>
          <input type="hidden" name={name} value={value} />
          {render(value)}
          <button
            type="button"
            class="chip-remove"
            aria-label={`${value} を外す`}
            hx-vals={JSON.stringify({ remove: value })}
            {...swap}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
