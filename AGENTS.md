# AGENTS.md (poc)

A resume app for software engineers. A PoC built as **an MPA with Bun + Hono + htmx**, testing a technology choice and architecture that reduce token costs when AI does the development.

This file is a router. Read the docs for details.

## This directory is separate

Treat `poc/` as **separate** from the parent repository (the car showroom area map). The rules in the parent's AGENTS.md and CLAUDE.md (pnpm, Biome, where Zod schemas go, the glossary, the spec workflow, etc.) do not apply here.
Do not bring in the parent's business terms or code. The only thing touching the parent is `"!poc"` in the root `biome.json` (which excludes this directory from the parent's lint).

## Documents to read

| What you want to know | Document |
| --- | --- |
| Table of contents | [docs/README.md](docs/README.md) |
| Technologies used, versions, and what we deliberately don't use | [docs/tech-stack.md](docs/tech-stack.md) |
| Directory layout, route list, request flow, DB abstraction, security | [docs/architecture.md](docs/architecture.md) |
| Procedures, how to write tests, pitfalls we hit | [docs/development-tips.md](docs/development-tips.md) |
| How to add a page, a chip field, a DB, a position, or a technology alias | [docs/recipes.md](docs/recipes.md) |
| What we are building and what the user decided | [docs/spec.md](docs/spec.md) |

## Commands (all run in poc/)

```sh
export PATH="$HOME/.bun/bin:$PATH"   # when bun is not found
bun install
bun run dev          # http://localhost:3000 (--hot)
bun test             # run on every change
bun run typecheck
bun run lint         # Biome (checks lint, formatting, import order)
bun run format       # fix with Biome
```

## Rules you must follow

- **Use Bun only.** Do not use npm, pnpm or yarn. Add dependencies with `bun add --exact <pkg>@<version>` (pinned versions). When you upgrade, also update the table in docs/tech-stack.md
- **The only client-side JS is htmx.** Do not use your own JS, inline `<script>`, `style` attributes, `hx-on`, or htmx trigger filter expressions (the CSP allows only `'self'`). To change state, fetch a fragment from the server
- **Work without JS.** Return a fragment for htmx requests (`isHtmx(c)`), otherwise the full page or a redirect (303)
- **Mutating operations are POST only.** Do not use `hx-delete` and the like (the CSRF check would no longer apply)
- **SQL lives only in `src/db/<driver>/`.** Routes touch only `c.var.repos` (`src/db/ports.ts`). If you change the repository contract, also update `test/repository-contract.ts`
- **Write the test first and watch it fail before implementing.** At the end of a change, `bun run format && bun test && bun run typecheck && bun run lint` must pass
- **HTML is pinned with snapshots.** If a snapshot fails on a change that should not alter the look, that is a behavior change. Only when you changed the look, read the diff and then run `bun test --update-snapshots` (docs/development-tips.md)
- **Check UI changes in a browser too.** Also confirm no CSP violations appear in the console. To avoid polluting the user's `data/`, start on a different port with a temporary DB (docs/development-tips.md)
- **Ask before deleting or rewriting the user's DB (`data/`)**
- **Do not write secrets (passwords, etc.) in chat or commits**
- If a code change makes the docs inaccurate, fix the docs in the same commit. Record the user's decisions in docs/spec.md, with dates (`docs/superpowers/` is a record of past work; do not update it)
- UI text is in Japanese

## Git

- End commits with `Co-Authored-By`
- **Ask the user before pushing or creating a PR** (we have been told not to create a PR from this branch)
