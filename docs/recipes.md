# How-tos for common changes

For every procedure, **write the test first, watch it fail, then implement, and finally run `bun run format && bun test && bun run typecheck && bun run lint`**.
How things work is in [architecture.md](architecture.md); pitfalls are in [development-tips.md](development-tips.md).

## Adding a page (route)

1. In the feature directory's `routes.tsx` (create the directory if needed), write a function that returns a `Hono<AppEnv>`
2. If login is required, apply `routes.use("<path>", requireAuth)` (`auth/session.ts`) at the top of the function. The logged-in user is `currentUser(c)` (typed as `User`), the user's own resume is `ownResume(c)` (`resume/own-resume.ts`), and the DB is `c.var.repos`
3. Wrap pages in `Layout` (`views/layout.tsx`) and return them with `c.html(...)`. Put components in `views/`
4. Make mutating operations **POST**. If you return a fragment for htmx, branch on `isHtmx(c)` (`html.ts`); without JS, return the full page or a redirect (303). For routes that return only a fragment, put `htmxOnly("<page to fall back to>")` in front
5. To receive multiple form values with the same name, use `c.req.parseBody({ all: true })`
6. Add `app.route("/", <function>())` in `src/app.ts`
7. Add a row to the route list in [architecture.md](architecture.md)

## Adding a chip-input field

Example: add "areas of expertise" (`domains`) to the resume.

1. Add `domains: { icons: false, placeholder: "…" }` to `CHIP_FIELDS` in `views/chip-input.tsx` (use `icons: true` to suggest technology icons). This enables `/chips/domains/*`
2. Put `<ChipInput field="domains" selected={[values.domains ?? []].flat()} />` in the form
3. In validation, extract the values with `chipValues(form, "domains")` (`resume/validation.ts`) and check the limit
4. Add storage: the type in `db/ports.ts`, the column in `db/sqlite/schema.ts`, and reading/writing in `db/sqlite/index.ts`. Even if an existing DB lacks the column, missing columns are added at startup from `ADDED_COLUMNS` in `db/sqlite/schema.ts` ("DB abstraction" in `docs/architecture.md`). Also list new columns in `ADDED_COLUMNS`
5. Add the display to the view component (`views/resume-view.tsx`)

## Adding another DB

1. In `src/db/<driver>/index.ts`, create a function that returns `Repositories` (`src/db/ports.ts`)
2. Add one line, `case "<driver>":`, to the `switch` in `src/db/index.ts`
3. Add one line, `repositoryContract("<driver>", () => <function creating the new implementation>)`, to `test/db.test.ts` and run `bun test`. This checks the same contract as SQLite (`test/repository-contract.ts`) (round-tripping per-language text 〔`{ ja, en }`〕 is also checked by this contract test)
4. Start with `DB_DRIVER=<driver> DATABASE_URL=<connection> bun run dev`

Things to watch out for:

- `ensureForUser` does "create if missing" in a single statement (find-then-create can overwrite a concurrent save with empty values)
- Provide a tie-breaker that orders work-history entries with the same start month by newest creation first (SQLite uses `rowid`)
- Creation timestamps are currently set by `new Date()` inside the implementation

## Adding a translation implementation

Follow these steps for OpenAI, Bedrock, etc. as well.

1. Implement `Translator` in `src/translate/<name>.ts`. Turn failures and timeouts into `TranslationError`, and pass the result through `assertSameShape(texts, result)` before returning it
2. Add one line to the `switch` in `createTranslator` in `src/translate/index.ts`
3. Write tests without calling the real provider, using a fake execution (child process, HTTP, etc.). Route-side tests use `test/fake-translator.ts`
4. Add the name to `TRANSLATOR` in the README's environment variable table

## Adding a position

- Add it to `positions` of the matching group in `POSITION_GROUPS` in `resume/positions.ts`. It is reflected automatically in the dropdown and the badge color
- If you create a new group, add a `.pos-<key>` color matching its `key` to `public/app.css`
- **Do not rename registered positions** (the DB stores the name as a string. If you rename one, the old name becomes a value not in the list, and it disappears when that work-history entry is edited and saved)

## Adding a technology alias / changing suggestion order

- For aliases like "Golang → Go", add `normalized name: "slug"` to `ALIASES` in `icons/index.ts`. Normalization lowercases, converts `+`→`plus`, `.`→`dot`, `&`→`and`, and removes non-alphanumerics (`normalizeTechName`)
- The slug is the simple-icons name: `bun -e 'import * as i from "simple-icons"; console.log(Object.values(i).filter(x => /go/i.test(x.title)).map(x => x.slug))'`
- To list a technology earlier in suggestions, add its slug to `COMMON` in the same file
