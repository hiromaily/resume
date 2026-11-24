# Resume app PoC (an MPA with Bun + Hono + htmx)

A testbed for **an MPA built with Bun + Hono + htmx**, as a technology choice that reduces token costs when AI does the development.
As a sample, it contains an app for software engineers to register, view and share their resumes via share links.

- Spec (what we build, why, and what was decided): [docs/spec.md](docs/spec.md)

## Prerequisites

- Bun 1.4.4. If installed into `~/.bun/bin`, it may not be on your shell's PATH: `export PATH="$HOME/.bun/bin:$PATH"`
- Do not use npm / pnpm / yarn. Add dependencies with `bun add --exact <pkg>@<version>`

## Running

From the repository root, run:

```sh
bun install
bun run dev        # http://localhost:3000
```

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `DB_DRIVER` | `sqlite` | DB implementation |
| `DATABASE_URL` | `./data/app.db` | SQLite file (`:memory:` also works) |
| `PORT` | `3000` | Port to listen on |
| `TRANSLATOR` | (none) | Translation implementation. If unset, translation is disabled. `claude-cli` (for local use; `claude` must be on PATH and logged in) |
| `SECURE_COOKIES` | (none) | `true` adds `Secure` to the cookie and renames it to `__Host-sid` (for HTTPS) |

## Deploy a demo on Render

See [Deployment on Render](docs/deployment.md) for setup, verification, and free-tier limits.

## Checks

```sh
bun test           # Tests (call app.request() without starting a server; the DB is in-memory)
bun run typecheck  # tsc --noEmit
bun run lint       # Biome (lint, formatting, import order). To fix: bun run format
```

## Documentation

The technologies used, directory layout, development tips and how-tos for common changes are in [docs/](docs/README.md).
