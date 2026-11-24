# Development tips

Run all commands from the repository root.

## Everyday commands

```sh
export PATH="$HOME/.bun/bin:$PATH"   # when bun is not found (if installed into ~/.bun/bin, it may not be on PATH)
bun install
bun run dev                          # http://localhost:3000 (--hot; changes under src apply immediately)
bun test                             # all tests (a few seconds)
bun run typecheck                    # type checking
bun run format                       # Biome: format, sort imports, apply safe lint fixes
bun run lint                         # Biome check (no fixes; fix remaining findings by hand)
```

- **`error: Failed to start server. Is port 3000 in use?`** → another server is using 3000. Check with `lsof -nP -iTCP:3000 -sTCP:LISTEN`, or start on another port, e.g. `PORT=3300 bun run dev`
- **Start over from scratch** → stop the server and `rm -rf data`. Tables are created on the next start
- **Look inside the DB** → `sqlite3 data/app.db "select email, created_at from users;"`

## Writing tests

- Don't start a server. `testApp()` (`test/helpers.ts`) builds the app with an in-memory DB, and you call it with `app.request()`
- For pages that require login, call `const { cookie } = await signupAndLogin(app)` and then send `headers: { cookie }`
- Use `post(app, path, data, headers)` for POST. **`origin: "http://localhost"` is required** (without it, the CSRF check returns 403). `post()` already adds it
- To send multiple values with the same name, pass an array (`positions: ["EM", "CTO"]`)
- To test htmx requests, add `"HX-Request": "true"`
- To advance time, change `clock.now` from `testApp()` (e.g. tests for session expiry)
- **Write the test first and watch it fail before implementing** (this PoC was built that way)
- **The full HTML of pages is pinned with snapshots** (`test/html-snapshot.test.ts` and `test/__snapshots__/`). For a refactor that doesn't change the look, if `bun test` passes, the HTML hasn't changed either. When you change the look, the tests fail; read the diff, and if it's as intended, rewrite with `bun test --update-snapshots` and commit the snapshots too
- When you add a new page or fragment, also add a line to `html-snapshot.test.ts`. Values that change on every run (IDs, tokens, the CSS version, the list of years) are replaced with fixed strings by `normalize()`. Add new ones there

## Checking in a browser

- To avoid polluting your local data, start on another port with a temporary DB:
  `PORT=3300 DATABASE_URL=/tmp/resume-check/app.db bun src/index.ts`
- CSP violations show up in the browser console (`Refused to ...`). Look at least once after changing the UI
- Delete buttons show a confirmation dialog via `hx-confirm`. When driving the browser automatically, don't click them, since the dialog blocks further actions

## Resetting a password locally

Passwords are stored only as hashes, so the original value is unknown. If you forget one, overwrite the hash:

```sh
bun -e '
import { Database } from "bun:sqlite";
const db = new Database("data/app.db");
const hash = await Bun.password.hash("<new password>", { algorithm: "argon2id" });
console.log(db.query("update users set password_hash = $h where email = $e").run({ h: hash, e: "<email address>" }).changes);
'
```

The login attempt limit (5 per 15 minutes) is counted in memory, so restarting the server clears it.

## Pitfalls we hit (symptom → cause → fix)

### htmx and CSP

- **The `<style>` htmx injects is blocked by the CSP (`style-src 'self'`)** → by default htmx 2 injects the indicator styles with `<style>` → we preemptively set `includeIndicatorStyles: false` in `htmx-config` (`views/layout.tsx`)
- **Validation error (422) HTML doesn't appear on the page** → by default htmx 2 does not swap 4xx responses → swap 422 via `responseHandling` in `htmx-config`
- **`hx-on` and trigger filters (`keyup[key=='Enter']`) don't work** → both use eval, which the CSP (`'self'` only) blocks → don't use them. Change state by fetching from the server (as the chip input does)
- **The CSRF check doesn't apply to `hx-delete` requests** → Hono's `csrf` only inspects requests with form Content-Types → make mutating operations POST only

### htmx behavior

- **The item picked from the dropdown goes to the front of the chips (reverse of selection order)** → htmx sends the value of the element that triggered the request before the `hx-include` values. If the dropdown and the chips share a name, the new item comes first → give the dropdown a different name (`position_pick`) and append on the server
- **Clicking a suggestion and rewriting the input's value puts the cursor back at the start** → even with `autofocus` on the swapped input, the cursor lands at the start. Moving it to the end requires JS → move the picked item into a chip and clear the input
- **No suggestions appear when typing Japanese** → `hx-trigger="keyup ..."` is unreliable for IME commits and pastes → `hx-trigger="input changed delay:200ms"`

### HTML and CSS

- **Buttons are vertically misaligned** → putting a `<form>` inside a `<p>` makes the browser close the `<p>` early → lay out buttons in `<div class="buttons">` (checked by `test/markup.test.ts`)
- **CSS changes don't show up in the browser** → CSS previously served with `max-age=3600` was still cached → add a content version (`?v=`) to the CSS URL and respond with `no-cache` ("CSS and caching" in [architecture.md](architecture.md))

### Forms and the server

- **Only one of several same-named values gets saved** → `c.req.parseBody()` returns only the last value for a name → use `parseBody({ all: true })` in routes that receive chips or positions
- **The login attempt limit doesn't hold under concurrent requests** → counting failures after verification (await) lets all concurrent requests pass as "still 0 attempts" → count before verifying, and undo on success
- **Just opening a page creates an empty resume** → list and edit routes were calling "create if missing" → create only when adding a work-history entry

### Dependencies

- **simple-icons has no AWS icons** → AWS-related icons were removed from simple-icons at Amazon's request → for technologies without an icon, suggest the typed word itself and display it as a text badge
- **No icon for "Golang"** → in simple-icons the name is "Go" → add it to the alias table (`ALIASES` in `icons/index.ts`)
