# Tech stack

The aim of this PoC is to test **a technology choice and architecture that reduce token costs when AI does the development** ([spec.md](spec.md)).
The selection criteria are "little code and few dependencies to read" and "the server's HTML is the source of truth; the client holds no state".

## What we use

Versions are pinned in `package.json` without `^` (the `latest` as of 2026-10-31).

| Technology | Version | Role | Why we chose it |
| --- | --- | --- | --- |
| [Bun](https://bun.sh/) | 1.4.4 | Runtime, package manager, tests (`bun test`), SQLite (`bun:sqlite`), password hashing (`Bun.password`) | One tool covers it all, so fewer dependencies and less config |
| [Hono](https://hono.dev/) | 4.13.14 | Routing, middleware (`secureHeaders`, `csrf`, cookies), HTML rendering (`hono/jsx`) | Small, and renders JSX on the server. `app.request()` lets you test without starting a server |
| [htmx](https://htmx.org/) | 2.0.11 | Swapping fragments (adding/editing/deleting work history, chip input, suggestions, toggling "currently employed") | Updates parts of the page while staying an MPA, without writing client-side JS |
| [simple-icons](https://simpleicons.org/) | 16.36.0 | Technology icons (SVG paths and brand colors) | Installed from npm and served by our server (no reliance on a CDN) |
| TypeScript | 7.0.2 | Type checking (`bun run typecheck` = `tsc --noEmit`). Bun runs the code directly | ― |
| @types/bun | 1.4.4 | Types for Bun | ― |
| [Biome](https://biomejs.dev/) | 2.6.4 | Lint and format (`bun run lint` = `biome check .`, `bun run format` = `biome check --write .`). Config is `poc/biome.json` | One tool and one config handle lint, formatting and import sorting, and it is fast (written in Rust) |
| Claude CLI (optional) | ― | Translation drafts (`TRANSLATOR=claude-cli`). Used only when `claude` is on PATH and logged in | Lets us try it with the local login, without the provider's SDK or an API key |

Biome covers TS, TSX, JSON and CSS. **Markdown is excluded, and CSS is linted but not formatted** (2.6 column-aligns Markdown tables and expands one-line CSS rules into multiple lines; both only add lines and tokens). The formatting settings (2 spaces, double quotes, 120 columns) match the code as it was before Biome was introduced.

htmx uses `latest`, 2.0.11 (the `next` dist-tag is 4.0.0, but we don't adopt it).

## What we deliberately don't use

| Not used | Reason | Instead |
| --- | --- | --- |
| npm, pnpm, yarn | Bun is enough | `bun add --exact`, `bun pm view` |
| Client-side JS frameworks, a build step, our own JS | No SPA (an anti-goal in spec.md). Keep the CSP at `'self'` only | htmx and server-rendered HTML |
| ORMs, query builders | Fewer dependencies and less code to read | The repository interface (`src/db/ports.ts`) and plain SQL on `bun:sqlite` |
| Migration tools | Not needed at PoC scale | `CREATE TABLE IF NOT EXISTS` at startup (`src/db/sqlite/schema.ts`) |
| Input validation libraries (Zod, etc.) | Keep dependencies minimal | Hand-written validation (`src/auth/validation.ts`, `src/resume/validation.ts`) |
| JWT | For a same-origin MPA, server-side sessions that can be revoked immediately are safer and simpler | Sessions stored in the DB (a random token in the cookie, its hash in the DB) |
| CDNs | No external dependencies at runtime | Serve htmx and icons from our own server |
| The parent repository's Biome config | Treated as separate (excluded by `"!poc"` in the parent's `biome.json`) | `poc/biome.json` |
| ESLint, Prettier, oxlint | More tools and config files | Biome |

## Checking and upgrading versions

```sh
bun pm view hono version          # latest version
bun pm view htmx.org dist-tags    # compare latest and next
bun add --exact hono@<version>    # upgrade (-d for devDependencies)
bun test && bun run typecheck && bun run lint   # always run after upgrading
```

After upgrading, update the versions in the table above in the same commit. After upgrading Biome, run `bunx biome migrate --write` to bring `biome.json` up to the new version.
