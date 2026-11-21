import { POSITION_GROUPS, type Position } from "../resume/positions";
import { RemovableChips } from "./removable-chips";
import { PositionBadge } from "./resume-view";

const swapAttrs = {
  "hx-get": "/resume/projects/positions",
  "hx-include": "closest .position-input",
  "hx-target": "closest .position-input",
  "hx-swap": "outerHTML",
};

/**
 * Position input. Choosing from the dropdown adds a chip (hidden positions input); × removes it.
 * Changes re-fetch this whole fragment via htmx (no custom JS). Without JS, the one value chosen in the dropdown is sent as is.
 * The dropdown has a name separate from positions because htmx sends the dropdown's own value first, which would reverse the chosen order
 */
export function PositionInput({ selected }: { selected: Position[] }) {
  return (
    <div class="position-input">
      <RemovableChips
        name="positions"
        values={selected}
        swap={swapAttrs}
        render={(p) => <PositionBadge position={p} />}
      />
      <select id="positions" name="position_pick" hx-trigger="change" {...swapAttrs}>
        <option value="">ポジションを追加…</option>
        {POSITION_GROUPS.map((g) => (
          <optgroup label={g.label}>
            {g.positions.map((p) => (
              <option value={p}>{p}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
