# Foundation for a resume app (Hono + htmx MPA) — Design

> A record of the design at the time. The current spec is [docs/spec.md](../../spec.md); this file is not kept up to date.

Created: 2026-10-31

## Intent and background

As a technology choice and architecture that can reduce token cost when having AI do the development, we try an **MPA (Multi-Page Application) built with Bun + Hono + htmx**.
We build that foundation in `poc/` and put a sample app on it: "a resume registration and viewing app for software engineers".

- How to measure the token-cost effect is **out of scope for this PoC** (it has already been evaluated quantitatively, separately). Here we confirm that an app can actually be built with this stack, and what shape the foundation takes.
- `poc/` is treated as **cut off from outside context**. The parent repository's (car showroom area map) business domain, terminology and rules (where Zod goes per AGENTS.md, pnpm, Biome, etc.) are not brought in.

## Goals

1. A Hono + htmx MPA foundation that is self-contained in `poc/` and runs with `bun install` → `bun run dev`
2. An abstracted DB, so we can switch from SQLite to another DB without changing app code
3. Sample app: user sign-up, login, registering and viewing your own resume, and viewing via a share link

## Non-goals

- Measuring or comparing token cost
- Implementing passkeys (WebAuthn) (only keep the design open to adding them later)
- Implementing DBs other than SQLite (only provide the switching point)
- Deployment, CI, production operation
- Share-link expiry, or naming individual viewers (allowing by email address)
- PDF export of the resume, multiple resumes

## Anti-goals (count as failure even if it works)

- It becomes an SPA (bringing in a client-side JS framework or a build step). The only client JS is htmx
- Depending on external CDNs or services at runtime (htmx and icons are also served from our own server)
- Getting mixed up with the parent repository's workspace, dependencies or configuration
- Sloppy authentication (plaintext passwords, raw tokens in the DB, no CSRF protection)

## Constraints

- **Runtime and package manager are Bun. Do not use npm / pnpm / yarn.** Adding dependencies and checking versions are also done with `bun add` / `bun pm view`
- **All versions are the latest** (the `latest` dist-tag). Results checked as of 2026-10-31:

  | Package | Version |
  | --- | --- |
  | Bun | 1.4.4 |
  | hono | 4.13.14 |
  | htmx.org | 2.0.11 (`next` is 4.0.0, but we take `latest`) |
  | simple-icons | 16.36.0 |
  | @types/bun | 1.4.4 |
  | typescript | 7.0.2 |

  `package.json` pins the versions actually installed (no `^`).
- Bun is installed in `~/.bun/bin`. It may not be on the shell's PATH, so note this in the README.

## Decisions (made by the user)

### Technology

- Bun + Hono + htmx MPA
- SQLite for now as the DB. Abstract it so it can be switched

### Authentication

- The initial idea was JWT, but we proceed with the proposal that, for a same-origin MPA, **server-side sessions** are safer and simpler (see "Design" below).

### Viewing permission

- Only **permitted people** can see a resume. To start, permission is granted via a **share link**
- For share links, **just changing (regenerating) the URL immediately invalidates the old URL**

### Resume contents

- Target audience is software engineers. One resume per user
- Fields: name, work history, skills, certifications, self-PR
- **Each work-history entry is one project.** Multiple projects at the same company are allowed
- Contents of one entry: period, company name, project name, duties, technologies used, positions
- **The period is chosen with numeric dropdowns, one for year and one for month** (decided by the user on 2026-10-31, because `<input type="month">` was hard to use). Years range from the current year down to 1970. Start and end are placed on one line
- **Checking the 「就業中」 (Currently employed) checkbox makes the end year and month unselectable** (decided by the user on 2026-10-31). The toggle works by re-fetching the end part with htmx (so we don't write our own JS). If checked, the server ignores the end input and saves it as "present". If unchecked and the end is empty, it is an error
- **Display entries vertically, newest first, and within each entry stack the field groups above vertically** (as in sample v2 shown in the browser)
- Technologies used are shown as **icons**, so you can tell at a glance what is used
- Make positions (Tech Lead, EM, Architect, etc.) recognizable at a glance
- **Skills are a separate field the person writes themselves** (not automatically aggregated from the technologies in the work history)
- **Skills and certifications are also entered with the same chips as technologies** (decided by the user on 2026-10-31). Skills offer technology-icon suggestions; for certifications, the typed name itself is offered as a candidate to add

## Design

### Directories

```
poc/
  package.json  tsconfig.json  bun.lock  README.md  .gitignore
  docs/superpowers/specs/          this document
  src/
    index.ts                       startup (passes app to Bun.serve)
    app.ts                         Hono assembly (middleware, routes)
    config.ts                      environment variables
    db/
      ports.ts                     repository interfaces
      sqlite/                      bun:sqlite implementation and schema (DDL)
      index.ts                     the only place that picks the implementation from DB_DRIVER
    auth/                          passwords, sessions, guard, rate limiting
    resume/                        resume routes and rules
    share/                         share links
    views/                         hono/jsx layouts and components
    icons/                         resolving technology names → simple-icons SVGs
  public/                          htmx.min.js (copied from node_modules), CSS
  test/
```

### Rendering and htmx

- Return HTML from the server with `hono/jsx`. Page navigation uses ordinary links and forms
- Use htmx **only for swapping parts**. Examples: adding, editing and deleting a single work-history entry, regenerating the share link, suggestions for technology names
- On the same URL, return the fragment HTML if the `HX-Request` header is present, otherwise the whole page (it works via plain form submission even without htmx)
- Serve `htmx.min.js` by copying it from `node_modules/htmx.org/dist/` to `public/` (a `postinstall` script, or return it directly from a static-serving route at startup; the implementer chooses which)

### DB abstraction

- `db/ports.ts` holds repository interfaces per business unit (`UserRepository`, `SessionRepository`, `ResumeRepository`, `ShareLinkRepository`). All methods return a `Promise` (even with the synchronous `bun:sqlite`, to fit future asynchronous DBs)
- The implementation is `db/sqlite/` (`bun:sqlite`). **No ORM or query builder**
- `db/index.ts` reads the environment variables `DB_DRIVER` (default `sqlite`) and `DATABASE_URL` (default `./data/app.db`) and builds the implementation. **Adding another DB should only require adding one implementation directory and one line here**
- The schema is created at startup with `CREATE TABLE IF NOT EXISTS` (no migration tool)
- Tests run against in-memory SQLite (`:memory:`)

### Data

| Table | Main columns |
| --- | --- |
| users | id, email (unique), password_hash, created_at |
| sessions | id, user_id, token_hash, expires_at, created_at |
| resumes | id, user_id (unique), full_name, skills, certifications, self_pr, updated_at |
| projects | id, resume_id, start_ym, end_ym (NULL means "present"), company, project_name, duties, technologies (JSON array), positions (JSON array), created_at |
| share_links | id, resume_id (unique), token_hash, created_at |

- Work history is ordered by `start_ym` descending (ties broken by newest `created_at`). **No manual reordering feature** (my decision)
- Skills and certifications are stored as an array of strings, one per line (JSON). Skills are shown as text tags, with an icon added when they match simple-icons

### Authentication (an approach suited to a same-origin MPA)

- **Passwords**: `Bun.password.hash` (Argon2id). Minimum 12 characters
- **Sessions**: put a 32-byte random token in a cookie; store only the token's SHA-256 in the DB
  - Cookie: `HttpOnly; SameSite=Lax; Path=/`; with production-like settings, `Secure` and the `__Host-` prefix
  - Expires in 7 days. Logout deletes the DB row. Issue a new token on login (prevents session fixation)
- **CSRF**: Hono's `csrf` middleware (checks Origin) plus SameSite
- **Login rate limiting**: stop after a number of failures within a time window, per email address and IP. In-memory is fine for a PoC
- **Security headers**: Hono's `secureHeaders`. CSP is `script-src 'self'` (no inline scripts; also no htmx features that need inline evaluation, such as `hx-on`)
- A guard middleware that checks whether the user is logged in protects the resume editing routes
- No passkeys. But keep the authentication logic inside `auth/` so they can be added later

### Share links

- `/r/<token>`. The token is 32 random bytes encoded as base64url. Only its SHA-256 is stored in the DB
- From the owner's screen, they can 「作る」 (Create), 「作り直す」 (Regenerate) and 「止める」 (Stop)
  - Regenerate: replace the hash in the `share_links` row → the old URL immediately returns 404
  - Stop: delete the row
- The full link can be seen only once, right after creating or regenerating it (because the DB holds only the hash). After that it cannot be seen again; regenerate it if needed. **This is my (the designer's) decision**
- The share page is view-only. `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`
- Invalid tokens and nonexistent tokens are not distinguished; both return the same 404

### Screens

| Path | Content |
| --- | --- |
| `/` | To your own resume if logged in, otherwise to login |
| `/signup` `/login` `/logout` | Account |
| `/resume` | View your own resume (rendered with the same components as the share page) |
| `/resume/edit` | Edit (basic fields; adding, editing and deleting each work-history entry via htmx) |
| `/resume/share` | Create, regenerate and stop the share link |
| `/r/:token` | Share page (view-only) |
| `/icons/:slug.svg` | Technology icons |
| `/static/*` | htmx, CSS |

**Work-history display** (sample v2, copied to [2026-10-31-resume-layout-mockup.html](2026-10-31-resume-layout-mockup.html). Match the sample's field order and structure. Colors and spacing are for reference; no pixel-level match is needed): newest first, one card per entry, stacked vertically. Inside a card, label/value pairs are stacked vertically, in this order:

1. Period (`2023/04 – 現在`, where 「現在」 means "Present")
2. Company name
3. Project name
4. Duties (line breaks preserved)
5. Technologies used (icons; a text badge if there is no icon. Icons also get `title` and `alt` with the technology name)
6. Positions (color-coded badges)

### Positions and technologies (my decisions)

- **Positions are chosen, possibly several, from a fixed list**. The list is a constant in code (`src/resume/positions.ts`), divided into groups (engineering, infrastructure, operations, data, quality, technical leadership, management, product, design). Badge colors are per group
- **Positions are chosen from a grouped dropdown (combobox)** (decided by the user on 2026-10-31, because a row of checkboxes was cluttered). Selected ones line up as chips (removable with ×) in the order selected
- **Technologies are entered by name**: while typing, suggestions are shown from simple-icons names (htmx `hx-get` and `hx-trigger="keyup changed delay:200ms"`). What is saved is the display-name string. Matching is done by normalizing to the simple-icons slug
- **Technologies are chosen by clicking a suggestion** (decided by the user on 2026-10-31). Chosen technologies line up as chips (removable with ×) above the input, and the input is cleared for the next term. Technologies without an icon (e.g. AWS, removed from simple-icons at Amazon's request) can also be chosen, because the typed term itself is offered as a suggestion. Common aliases (Golang → Go, k8s → Kubernetes, etc.) are also mapped to icons
- Icon SVGs are taken from the simple-icons package, filled with the brand color, and returned from the server. Results are cached long via `Cache-Control`

### Input validation

- On the server, check types, lengths, the year-month format (`YYYY-MM`), and start ≤ end. **No validation library**; written by hand (to minimize dependencies. **My decision**)
- The required rule for name, company name and project name was changed to "filled in in either Japanese or English" (2026-10-31, decided by the user. [i18n design doc](2026-10-31-resume-i18n-design.md)). Length limits are the same for each language
- On error, return the same form with the messages and the entered values preserved

### Tests

- `bun test`
- Repositories (SQLite implementation): create, read, update, delete
- Authentication: sign-up, login, logout, guard, CSRF rejection
- Share links: the old URL returns 404 after regenerating, returns 404 after stopping, and you cannot edit someone else's resume
- HTTP is exercised with `app.request()` (without starting a server)

### Isolation from the parent repository

- **Commit to a new branch (`feat/poc-hono-htmx`, cut from develop). Do not create a PR** (user's instruction). Do not push either (no instruction to). So the parent's CI does not run

- `poc/` is not included in the pnpm workspace (`apps/*` and `packages/*`), so it can stay as is
- **The root `biome.json` targets `**`, so `poc/` gets linted too.** Add `"!poc"` to `files.includes` to exclude it (**the only change touching the parent**. My decision)
- `poc/.gitignore` excludes `node_modules/` and `data/` (the SQLite files)
- ~~No lint or format in this PoC (decide later if needed)~~ → **Decided by the user on 2026-10-31: add Biome (latest, 2.6.4).** Compared with Oxc (oxlint + oxfmt), we chose the one that needs one tool and one config. The config is `poc/biome.json` (separate from the parent's `biome.json`; the parent still excludes it with `"!poc"`). Details in [tech-stack.md](../../tech-stack.md)

## Left to the implementer

- How to split the `hono/jsx` components and how to write the CSS (keep it to what one plain CSS file can handle)
- How to copy htmx into `public/`
- The concrete number of attempts and time window for rate limiting
