# Architecture

An MPA where the server returns HTML. htmx is used only to "swap fragments", and everything works with ordinary form submission when JS is unavailable.

## Directory layout

```
./
  package.json  tsconfig.json  bun.lock  .gitignore  README.md
  data/                      SQLite files (not tracked by git; delete to reset to the initial state)
  public/app.css             the one and only CSS file
  src/
    index.ts                 startup (loadConfig → createRepositories → createApp → Bun.serve)
    app.ts                   middleware order and registration of each route
    config.ts                environment variables (DB_DRIVER, DATABASE_URL, PORT, SECURE_COOKIES)
    types.ts                 AppEnv (the type of Hono's c.var: user, repos, now)
    html.ts                  isHtmx(c) (looks at the HX-Request header), htmxOnly (for fragment-only routes, 303 to the page if not htmx)
    db/
      ports.ts               types and repository interfaces. The only DB the app knows about
      index.ts               the single place that picks the implementation by DB_DRIVER
      sqlite/schema.ts       DDL
      sqlite/index.ts        bun:sqlite implementation
    auth/
      tokens.ts              generateToken, hashToken (also used by share links)
      password.ts            Argon2id (Bun.password)
      session.ts             issuing sessions, the reading middleware, requireAuth, currentUser
      rate-limit.ts          login attempt limit (in memory)
      validation.ts          email and password validation
      routes.tsx             /signup /login /logout
    resume/
      own-resume.ts          ownResume(c) (the logged-in user's resume; also used by share links)
      positions.ts           list of positions (groups, badge colors)
      validation.ts          validation of resumes and work history, extraction of chip values (chipValues)
      routes.tsx             /resume/* (view, edit, work history, period and position fragments)
    share/routes.tsx         share links (/resume/share, /r/:token)
    icons/
      index.ts               tech name → simple-icons (normalization, aliases, suggestion ranking, SVG)
      routes.tsx             /icons/:slug.svg
    chips/routes.tsx         suggestions and add/remove for chip input (/chips/:field/*)
    views/
      layout.tsx             <html> shell, htmx config, CSS version
      resume-view.tsx        view components (resume, work-history cards, icons, badges). The share page uses the same ones
      forms.tsx              edit forms (basics, work history, period) and resumeToValues / projectToValues, which turn saved values into form values
      chip-input.tsx         chip input (technologies, skills, certifications, certifications (English))
      position-input.tsx     position dropdown and chips
      removable-chips.tsx    chips for picked values with an × button (used by chip input and position input)
  test/
    helpers.ts               testApp(), signupAndLogin(), post()
    repository-contract.ts   tests of the contract DB implementations must keep (the same tests run for every DB)
    html-snapshot.test.ts    full-HTML snapshots of pages and fragments (stored in __snapshots__/)
    *.test.ts(x)             per-feature tests
  docs/                      these documents
```

Placement rules:

- **UI components go in `views/`; routes go in the feature directory** (`auth/`, `resume/`, `share/`, etc.)
- **SQL is written only in `db/<driver>/`**. Routes touch only the `c.var.repos` interface
- Input validation goes in the feature directory's `validation.ts` and is called from routes

## Route list

| Method and path | Login | Role |
| --- | --- | --- |
| GET `/` | ― | To `/resume` if logged in, otherwise to `/login` |
| GET/POST `/signup`, GET/POST `/login`, POST `/logout` | ― | Account |
| GET `/resume` | Required | View your own resume. `?lang=ja\|en` selects the language (if absent, decided by `Accept-Language` and whether a name exists; "Japanese and English" in [spec.md](spec.md#japanese-and-english)) |
| GET/POST `/resume/edit` | Required | Edit page; saves the basics |
| GET `/resume/projects` | Required | Work-history list fragment (for canceling an edit) |
| POST `/resume/projects` | Required | Add a work-history entry (creates the resume here if none exists) |
| GET `/resume/projects/:id/edit`, POST `/resume/projects/:id`, POST `/resume/projects/:id/delete` | Required | Edit, update, delete a work-history entry. Someone else's ID returns 404 |
| POST `/resume/edit/draft`, POST `/resume/projects/draft`, POST `/resume/projects/:id/draft` | Required | Create a draft (only when translation is enabled; 404 otherwise). Using `from` and `to` in the body (each `ja`/`en`; anything else is 400; identical is 422), returns the form with the `to`-language fields filled with values translated from the `from` language, plus a notice and field markers. Does not save. The bar at the top of the form (language dropdowns and one button) has a button pairing `formaction` with `hx-post`, so it works as a full-page submit without JS. Because the bar is at the top of the form, an invisible save button is placed even before it so that Enter saves. While translating, `hx-indicator` adds `htmx-request` to the form, and CSS changes the button label and blocks interaction. `/resume/projects/draft` is registered before `/resume/projects/:id` |
| GET `/resume/projects/period-end` | Required | Re-fetches the end year/month fragment when toggling 「就業中」 (currently employed) |
| GET `/resume/projects/positions` | Required | Add/remove position chips |
| GET `/chips/:field/suggest`, GET `/chips/:field/pick` | Required | Suggestions and add/remove for chip input (field is technologies, skills, certifications, certifications_en) |
| GET/POST `/resume/share`, POST `/resume/share/delete` | Required | Share link status, create/regenerate, stop |
| GET `/r/:token` | ― | Share page (view only). `?lang=ja\|en` and the default rule are the same as `/resume`. `Vary: Accept-Language` |
| GET `/icons/:slug.svg` | ― | Technology icons |
| GET `/static/htmx.min.js`, GET `/static/app.css` | ― | htmx (served directly from `node_modules`) and CSS |

**Mutating operations are POST only** (no `hx-delete` and the like), because Hono's `csrf` middleware inspects only requests with form Content-Types.

## Request flow

### Full page vs. fragment

The same URL returns fragment HTML for htmx requests (`HX-Request: true`), otherwise the full page (or a redirect).

```
Browser (with htmx)                                  Server
  work-history "Save" ── POST /resume/projects ──▶ validate → save
                      ◀── only <section id="projects"> ──  (swaps hx-target="#projects")

Browser (no JS)
  work-history "Save" ── POST /resume/projects ──▶ validate → save
                      ◀── 303 → /resume/edit ───  (reloads the full page)
```

Validation errors are returned as **422**. htmx 2 doesn't swap 4xx by default, so `<meta name="htmx-config">` in `views/layout.tsx` is configured to swap 422 only.

### Middleware order (`src/app.ts`)

1. `secureHeaders` (CSP, etc.)
2. `csrf` (checks Origin; POSTs from another origin get 403)
3. Put `repos`, `now`, `user = null` into `c.var`
4. `sessionMiddleware` (sets `user` from the cookie's token)
5. Each route (`requireAuth` on those that require login)

`now` is passed via `c.var` so tests can advance time (`clock` from `testApp()`).

## DB abstraction

```
route ──▶ c.var.repos (Repositories: src/db/ports.ts) ──▶ src/db/sqlite/ (bun:sqlite)
                                     ▲
                       src/db/index.ts picks by DB_DRIVER
```

- Every repository method returns a `Promise` (even with the synchronous `bun:sqlite`, to match asynchronous DBs)
- The contract (ordering, not touching others' rows, `ensureForUser` not rewriting existing rows, etc.) lives in `test/repository-contract.ts`. When you add a DB, run the same tests (steps in [recipes.md](recipes.md))
- Arrays (skills, certifications, technologies, positions) are stored as JSON strings in TEXT columns
- Per-language text (name, certifications, self-PR; company name, project name, job description) is held as `Localized<T>` (`{ ja, en }`). Japanese goes in the original column, English in the `*_en` column (`full_name_en`, etc.). Skills, technologies and positions are not split by language
- Existing DBs lack the `*_en` columns, so at startup `ADDED_COLUMNS` in `src/db/sqlite/schema.ts` is consulted and only missing columns are added with `ALTER TABLE ... ADD COLUMN` (checked with `PRAGMA table_info`, so no matter how many times it starts, only missing columns are added). To add a column, add one line to `ADDED_COLUMNS`
- Work history is ordered by `start_ym` descending, then by newest `created_at`, and if that is also equal (same millisecond), by SQLite `rowid` descending. Another DB must provide this final tie-breaker itself

## Translation abstraction

```
route ──▶ c.var.translator (Translator | null: src/translate/ports.ts) ──▶ each implementation (src/translate/<name>.ts)
                                       ▲
                         src/translate/index.ts picks by TRANSLATOR
```

- `Translator.translate(texts, from, to)` takes a string or an array of strings per key and returns the same keys with the same types (arrays of the same length)
- If `TRANSLATOR` is unset, `createTranslator` returns `null` and translation is disabled (`c.var.translator` is `null`)
- Provider failures, timeouts and malformed results all become `TranslationError`. Each implementation passes its result through `assertSameShape` before returning it
- `claude-cli` (`src/translate/claude-cli.ts`) runs `claude -p` as a child process. The prompt (instructions plus the text as JSON) is passed via stdin rather than arguments, and the child process is killed on timeout (default 120 seconds). It runs in an empty temporary directory (deleted afterwards) to avoid loading the app repository's Claude instructions and settings. The `--strict-mcp-config` flag keeps it from loading MCP servers. `stderr` may contain the text, so it is not included in error messages
- **Caution**: translating sends the text to the provider (Anthropic). Anyone can sign up, so with `TRANSLATOR` enabled, any logged-in user can run the host's CLI (with the host's login). The public Render demo leaves `TRANSLATOR` unset
- Tests pass the fake execution from `test/fake-translator.ts` to `testApp({ translator })`

## Auth and security

| Item | Mechanism | Location |
| --- | --- | --- |
| Passwords | Hashed with Argon2id (12–128 characters) | `auth/password.ts`, `auth/validation.ts` |
| Sessions | 32 random bytes in the cookie; the DB stores only its SHA-256. Valid for 7 days. A new token is issued on every login | `auth/session.ts`, `auth/tokens.ts` |
| Cookie | `HttpOnly; SameSite=Lax; Path=/`. With `SECURE_COOKIES=true`, `Secure` and the name `__Host-sid` | `auth/session.ts` |
| Login attempt limit | 5 per 15 minutes per email address and IP. Counted before verification (await) (counting afterwards lets concurrent requests slip through) | `auth/rate-limit.ts`, `auth/routes.tsx` |
| CSRF | Hono's `csrf` (Origin) and SameSite | `app.ts` |
| CSP | `default-src`, `script-src`, `style-src`, `img-src`, `form-action` set to `'self'`; `frame-ancestors 'none'` | `app.ts` |
| Others' data | SQL always filters by `resume_id`. Someone else's work-history ID returns 404 | `db/sqlite/index.ts`, `resume/routes.tsx` |
| Share links | 32 random bytes. The DB stores only the hash. Regenerating makes the old URL 404 immediately. The share page has `noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` | `share/routes.tsx` |
| Escaping | Done automatically by `hono/jsx`. The only hand-built HTML is the icon SVG (its title is escaped) | `icons/index.ts` |

Because the CSP is `'self'` only, **inline `<script>`, `style` attributes, `hx-on` (uses eval) and htmx trigger filters (expressions like `keyup[key=='Enter']`) cannot be used**.

## How chip input works

Technologies, skills, certifications and positions show picked items as chips. They all share the same shape.

```
<div class="chip-input">
  <ul class="chips">
    <li><input type="hidden" name="skills" value="Golang"> [Golang] [×]</li>   ← picked items (sent on form submit)
  </ul>
  <input name="skills_query">   ← field for typing the next word. Fetches /chips/skills/suggest on every input
  <ul class="suggest">suggestion buttons</ul>
</div>
```

- Clicking a suggestion or × makes htmx send all current chips via `hx-include="closest .chip-input"`; the server returns **the whole `.chip-input`** after adding/removing, and it is swapped in. This shape lets state change without writing our own JS
- The input is empty after the swap. If we rewrote the input's value instead, the cursor would jump back to the start and you couldn't keep typing ([development-tips.md](development-tips.md))
- On save, the chips (`skills`) and any words left in the input (`skills_query`, comma- or newline-separated) are combined (`chipValues`). Even without JS, typing comma-separated words in the input saves them
- Positions alone are picked from a dropdown (`position_pick`). It fetches `/resume/projects/positions` with the same mechanism

## CSS and caching

- CSS is the single file `public/app.css`. It is loaded with `<link href="/static/app.css?v=<hash of contents>">`, and the response carries `Cache-Control: no-cache`
- The version is computed when the module loads. With `bun run dev` (`--hot`), editing **only CSS** doesn't change the version, but because of `no-cache` the browser revalidates every time and gets the new CSS
