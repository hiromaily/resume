# Resume App (Hono + htmx MPA) Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of a Bun + Hono + htmx MPA that is fully self-contained in `poc/`, and put a sample app on it for registering, viewing, and sharing (via link) a resume.

**Architecture:** `hono/jsx` returns HTML from the server, and htmx is used only for swapping parts of the page (forms work without JS). The DB is hidden behind repository interfaces (`src/db/ports.ts`), and the `bun:sqlite` implementation is selected in one place, `src/db/index.ts`. Authentication uses sessions stored in the DB (a random token in the cookie, its hash in the DB).

**Tech Stack:** Bun 1.4.4 / hono 4.13.14 / htmx.org 2.0.11 / simple-icons 16.36.0 / typescript 7.0.2 / @types/bun 1.4.4 / bun:sqlite / bun test

**Spec:** [poc/docs/superpowers/specs/2026-10-31-resume-app-design.md](../specs/2026-10-31-resume-app-design.md) (mockup: [2026-10-31-resume-layout-mockup.html](../specs/2026-10-31-resume-layout-mockup.html))

## Global Constraints

- Run all commands in `poc/`. If Bun is not on PATH: `export PATH="$HOME/.bun/bin:$PATH"`
- **Do not use npm / pnpm / yarn in poc/.** Add dependencies with `bun add --exact <pkg>@<version>` (`-d` for devDependencies). Pin versions as listed in the Tech Stack above
- The only change to the parent repository is adding `"!poc"` to `files.includes` in the root `biome.json`
- The only client JS is htmx. Do not use inline `<script>`, `style` attributes, or `hx-on` (the CSP allows only `'self'`)
- Do not use external CDNs at runtime
- Only POST is used as a mutating HTTP method (do not use `hx-delete` etc., because the CSRF middleware only checks the Content-Type of forms)
- Commit to `feat/poc-hono-htmx` at the end of each task. **Do not push or create a PR.** End messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- UI text is in Japanese

## Review Focus

1. **Putting another user's project ID in the URL** (`/resume/projects/<other user's id>/edit` or `/delete`) → 404, and nothing changes. Verified by the Task 5 tests
2. **Putting `<script>` in the name, responsibilities, etc.** → escaped and rendered as text (the same on the shared page). Verified by the Task 4 and Task 7 tests
3. **Opening with the cookie of an expired session** → treated as logged out and sent to `/login`. Verified by the Task 3 tests
4. **Year-month of `2024-13`, or an end before the start** → 422, returned with the message and the entered values preserved. Verified by the Task 5 tests
5. **Signing up with an already registered email address / logging in with a nonexistent email address** → sign-up says 「既に使われています」 (already in use). Login uses the same message as a wrong password, so the two are indistinguishable. Verified by the Task 3 tests

---

## File Structure

```
poc/
  package.json  tsconfig.json  bun.lock  .gitignore  README.md
  public/app.css
  src/
    index.ts             Starts Bun.serve
    app.ts               createApp(deps): assembles middleware and routes
    config.ts            loadConfig(env)
    types.ts             AppEnv (Hono Variables)
    html.ts              isHtmx(c)
    db/ports.ts          Types and repository interfaces
    db/index.ts          createRepositories(config)
    db/sqlite/schema.ts  DDL
    db/sqlite/index.ts   createSqliteRepositories(path)
    auth/tokens.ts       generateToken / hashToken (also used by share links)
    auth/password.ts     hashPassword / verifyPassword
    auth/session.ts      Session issuing, reading middleware, requireAuth
    auth/rate-limit.ts   createRateLimiter
    auth/validation.ts   validateCredentials
    auth/routes.tsx      /signup /login /logout
    resume/positions.ts  POSITIONS
    resume/validation.ts validateResumeInput / validateProjectInput
    resume/routes.tsx    /resume /resume/edit /resume/projects/*
    share/routes.tsx     /resume/share /r/:token
    icons/index.ts       resolveIcon / suggestIcons / iconSvg
    icons/routes.ts      /icons/*
    views/layout.tsx     Layout
    views/resume-view.tsx ResumeView, ProjectCard, TechIcon, PositionBadge
    views/forms.tsx      Edit form components
  test/helpers.ts        testApp(), signupAndLogin()
  test/*.test.ts(x)
```

---

### Task 1: Foundation (startup, static serving, security headers, isolation from the parent)

**Files:**
- Create: `poc/package.json`, `poc/tsconfig.json`, `poc/.gitignore`, `poc/src/index.ts`, `poc/src/app.ts`, `poc/src/config.ts`, `poc/src/types.ts`, `poc/src/html.ts`, `poc/src/views/layout.tsx`, `poc/public/app.css`, `poc/test/helpers.ts`, `poc/test/app.test.ts`
- Modify: `biome.json` (root; add `"!poc"` to `files.includes`)

**Interfaces:**
- Produces:
  - `type AppConfig = { dbDriver: string; databaseUrl: string; port: number; secureCookies: boolean }`
  - `loadConfig(env: Record<string, string | undefined>): AppConfig`. `DB_DRIVER` (default `"sqlite"`), `DATABASE_URL` (default `"./data/app.db"`), `PORT` (default `3000`), `SECURE_COOKIES` (true only when `"true"`)
  - `type AppDeps = { repos: Repositories; config: AppConfig; now?: () => Date }`, `createApp(deps: AppDeps): Hono<AppEnv>` (Task 1 does not use `repos`. Its type is fixed in Task 2, so `unknown` is fine until then)
  - `type AppEnv = { Variables: { user: User | null; repos: Repositories; now: () => Date } }` (`src/types.ts`)
  - `isHtmx(c: Context): boolean` (checks `HX-Request: true`)
  - `Layout(props: { title: string; user?: User | null; children: Child }): JSX`
  - `testApp(): { app: Hono<AppEnv>; repos: Repositories; clock: { now: Date } }` (`test/helpers.ts`. In-memory DB. Advance time by rewriting `clock.now`)

- [ ] **Step 1:** In `poc/`, do not use `bun init`; write `package.json` by hand (`"type": "module"`, `"private": true`, scripts: `"dev": "bun --hot src/index.ts"`, `"start": "bun src/index.ts"`, `"test": "bun test"`, `"typecheck": "tsc --noEmit"`). Install dependencies:
  `bun add --exact hono@4.13.14 htmx.org@2.0.11 simple-icons@16.36.0` and `bun add -d --exact typescript@7.0.2 @types/bun@1.4.4`
- [ ] **Step 2:** `tsconfig.json`: `target`/`module` `ESNext`, `moduleResolution` `bundler`, `jsx` `react-jsx`, `jsxImportSource` `hono/jsx`, `strict` true, `noEmit` true, `types` `["bun"]`, `rootDir` `.`, `include` `["src", "test"]`. `.gitignore`: `node_modules/`, `data/`
- [ ] **Step 3: Write the failing tests** (`test/app.test.ts`)

```ts
test("GET / redirects to /login when not logged in", async () => {
  const { app } = testApp();
  const res = await app.request("/");
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login");
});
test("serves htmx from our own server", async () => {
  const res = await testApp().app.request("/static/htmx.min.js");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("javascript");
});
test("CSP allows only self", async () => {
  const res = await testApp().app.request("/login");
  expect(res.headers.get("content-security-policy")).toContain("script-src 'self'");
});
```

  (`/login` may be 404 until Task 3. The header check also applies to the 404 response)
- [ ] **Step 4:** `bun test test/app.test.ts` → FAIL
- [ ] **Step 5: Implement**
  - `app.ts`: `secureHeaders` (`contentSecurityPolicy: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"] }`) → `csrf()` (`hono/csrf`) → middleware that does `c.set` for `repos` and `now`. `/static/htmx.min.js` returns `Bun.file("node_modules/htmx.org/dist/htmx.min.js")` (`content-type: text/javascript`). `/static/app.css` is `public/app.css`. `GET /` redirects with 302 to `/resume` if `c.var.user` is set, otherwise to `/login` (`user` is always null until Task 3)
  - `Layout`: `<meta name="htmx-config" content='{"includeIndicatorStyles":false,"responseHandling":[{"code":"204","swap":false},{"code":"[23]..","swap":true},{"code":"422","swap":true},{"code":"[45]..","swap":false,"error":true}]}'>` (prevents injecting inline styles, and swaps in 422 validation errors), `<script src="/static/htmx.min.js" defer>`, `<link rel="stylesheet" href="/static/app.css">`, and in the header, the email address and a logout form when logged in
  - `index.ts`: `loadConfig(Bun.env)` → `createRepositories` → `Bun.serve({ port, fetch: app.fetch })`
- [ ] **Step 6:** `bun test` → PASS, `bun run typecheck` → no errors
- [ ] **Step 7:** Add `"!poc"` to the root `biome.json`, run `pnpm exec biome check poc/src/app.ts` at the repository root → confirm it reports that there are no target files (ignored)
- [ ] **Step 8: Commit** `feat(poc): Scaffold the Bun + Hono + htmx app`

---

### Task 2: DB abstraction and the SQLite implementation

**Files:**
- Create: `poc/src/db/ports.ts`, `poc/src/db/index.ts`, `poc/src/db/sqlite/schema.ts`, `poc/src/db/sqlite/index.ts`, `poc/src/resume/positions.ts`, `poc/test/db.test.ts`

**Interfaces:**
- Produces (`src/db/ports.ts`):

```ts
export type User = { id: string; email: string; passwordHash: string; createdAt: string };
export type Session = { id: string; userId: string; tokenHash: string; expiresAt: string; createdAt: string };
export type ResumeInput = { fullName: string; skills: string[]; certifications: string[]; selfPr: string };
export type Resume = ResumeInput & { id: string; userId: string; updatedAt: string };
export type ProjectInput = {
  startYm: string; endYm: string | null; company: string; projectName: string;
  duties: string; technologies: string[]; positions: Position[];
};
export type Project = ProjectInput & { id: string; resumeId: string; createdAt: string };
export type ShareLink = { id: string; resumeId: string; tokenHash: string; createdAt: string };

export interface UserRepository {
  create(email: string, passwordHash: string): Promise<User>;   // throws DuplicateEmailError on a duplicate email
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
export interface SessionRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
}
export interface ResumeRepository {
  findByUserId(userId: string): Promise<Resume | null>;
  findById(id: string): Promise<Resume | null>;
  upsert(userId: string, input: ResumeInput): Promise<Resume>;
  ensureForUser(userId: string): Promise<Resume>;               // creates an empty resume if none exists
  listProjects(resumeId: string): Promise<Project[]>;            // start_ym descending → created_at descending
  findProject(resumeId: string, projectId: string): Promise<Project | null>;
  createProject(resumeId: string, input: ProjectInput): Promise<Project>;
  updateProject(resumeId: string, projectId: string, input: ProjectInput): Promise<Project | null>;
  deleteProject(resumeId: string, projectId: string): Promise<boolean>;
}
export interface ShareLinkRepository {
  findByResumeId(resumeId: string): Promise<ShareLink | null>;
  findByTokenHash(tokenHash: string): Promise<ShareLink | null>;
  replace(resumeId: string, tokenHash: string): Promise<ShareLink>; // one per resume; replaces the existing one
  delete(resumeId: string): Promise<void>;
}
export type Repositories = {
  users: UserRepository; sessions: SessionRepository;
  resumes: ResumeRepository; shareLinks: ShareLinkRepository; close(): void;
};
export class DuplicateEmailError extends Error {}
```

  - `createRepositories(config: { dbDriver: string; databaseUrl: string }): Repositories`. Anything other than `"sqlite"` throws `Error("Unsupported DB_DRIVER: <value>")`
  - `createSqliteRepositories(path: string): Repositories` (`":memory:"` allowed. For a file, creates the parent directory)
  - `POSITIONS = ["Engineer","Tech Lead","EM","Architect","PdM","SRE","QA","Designer"] as const`, `type Position = (typeof POSITIONS)[number]`, `positionClass(p: Position): string` (CSS class name, e.g. `"pos-tech-lead"`)
- Consumes: none

- [ ] **Step 1: Write the failing tests** (`test/db.test.ts`. All use `createSqliteRepositories(":memory:")`)
  - After `users.create`, `findByEmail` returns it. A second create with the same email throws `DuplicateEmailError`
  - `sessions.create` → retrievable with `findByTokenHash` → null after `delete`
  - Two `resumes.upsert` calls leave one row with the later values. The `skills` array survives the round trip
  - `listProjects` order: inserting `startYm` `2021-01`, `2023-04`, `2023-04` (the later-created one) gives `[2023-04(later), 2023-04(earlier), 2021-01]`
  - Passing a different `resumeId` to `updateProject` / `deleteProject` returns null / false, and the row is unchanged
  - Two `shareLinks.replace` calls → `findByTokenHash(first hash)` is null, and the second hash is retrievable
  - `createRepositories({ dbDriver: "mysql", databaseUrl: "" })` throws `Unsupported DB_DRIVER: mysql`
- [ ] **Step 2:** `bun test test/db.test.ts` → FAIL
- [ ] **Step 3: Implement.** The schema follows the "Data" table in the design doc (JSON arrays as TEXT). `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL` (for files). Foreign keys use `ON DELETE CASCADE`. IDs are `crypto.randomUUID()`. Times are ISO 8601 strings. To avoid ties in creation order, `created_at` keeps milliseconds, and within the same millisecond rows are ordered by `rowid` descending. All queries pass values through placeholders
- [ ] **Step 4:** `bun test` → PASS, `bun run typecheck` → no errors
- [ ] **Step 5: Commit** `feat(poc): Add repository ports and the bun:sqlite adapter`

---

### Task 3: Authentication (sign-up, login, logout, sessions, rate limiting)

**Files:**
- Create: `poc/src/auth/tokens.ts`, `poc/src/auth/password.ts`, `poc/src/auth/session.ts`, `poc/src/auth/rate-limit.ts`, `poc/src/auth/validation.ts`, `poc/src/auth/routes.tsx`, `poc/test/auth.test.ts`
- Modify: `poc/src/app.ts` (register the session middleware and routes), `poc/test/helpers.ts` (add `signupAndLogin`)

**Interfaces:**
- Consumes: `Repositories` (Task 2), `AppEnv`, `Layout`, `isHtmx` (Task 1)
- Produces:
  - `generateToken(): string` (base64url of 32 random bytes), `hashToken(token: string): string` (SHA-256 hex, via `Bun.CryptoHasher`)
  - `hashPassword(pw: string): Promise<string>` / `verifyPassword(pw: string, hash: string): Promise<boolean>` (`Bun.password`, `algorithm: "argon2id"`)
  - `sessionCookieName(config: AppConfig): string` (`"__Host-sid"` if `secureCookies`, otherwise `"sid"`)
  - `startSession(c: Context<AppEnv>, userId: string): Promise<void>` (issues a new token and puts it in the cookie. Expires in 7 days)
  - `endSession(c: Context<AppEnv>): Promise<void>`
  - `sessionMiddleware(config: AppConfig): MiddlewareHandler<AppEnv>` (cookie → `hashToken` → if not expired, `c.set("user", user)`. Deletes expired rows)
  - `requireAuth: MiddlewareHandler<AppEnv>` (302 to `/login` if there is no user. For htmx requests, 401 with `HX-Redirect: /login`)
  - `createRateLimiter(opts: { max: number; windowMs: number }): { isBlocked(key: string, now: Date): boolean; recordFailure(key: string, now: Date): void; reset(key: string): void }`. Login uses `max: 5, windowMs: 15 * 60 * 1000`. Two keys: `email:<email>` and `ip:<ip>` (IP via `getConnInfo`, `"unknown"` if unavailable)
  - `signupAndLogin(app, email?: string): Promise<{ cookie: string }>` (`test/helpers.ts`. Subsequent tests call with `headers: { cookie, origin: "http://localhost" }`)
- Cookie attributes: `HttpOnly; SameSite=Lax; Path=/`, plus `Secure` when `secureCookies`

- [ ] **Step 1: Write the failing tests** (`test/auth.test.ts`. Every POST uses `origin: "http://localhost"` and `content-type: application/x-www-form-urlencoded`)
  - Sign-up (email `a@example.com`, 12-character password) → 303 to `/resume`, `set-cookie` contains `sid=`, `HttpOnly`, and `SameSite=Lax`
  - `sessions.token_hash` in the DB does not equal the cookie value (it equals `hashToken(value)`)
  - 11-character password → 422, body contains 「12文字以上」 (at least 12 characters)
  - Second sign-up with the same email → 422, body contains 「既に使われています」
  - Login: a wrong password and a nonexistent email → both 401, with the same error message in the body (「メールアドレスまたはパスワードが違います」 (wrong email address or password))
  - 5 failures for the same email → the 6th attempt is 429 even with the correct password
  - `GET /` with a logged-in cookie → 302 to `/resume`
  - Advance `clock.now` by 7 days and 1 minute → `GET /resume/edit` is 302 to `/login` (Review Focus 3. `/resume/edit` is created in Task 4, so this test may verify with a temporary route that has `requireAuth`, to be replaced in Task 4)
  - After logout (POST `/logout`), the same cookie is treated as logged out
  - POST `/login` with `origin: "https://evil.example"` → 403
- [ ] **Step 2:** `bun test test/auth.test.ts` → FAIL
- [ ] **Step 3: Implement.** `validateCredentials(form): { ok: true; email: string; password: string } | { ok: false; errors: Record<"email"|"password", string>; email: string }`. The email is trimmed and lowercased, at most 254 characters, and matches `^[^\s@]+@[^\s@]+\.[^\s@]+$`. The password is 12–128 characters. On error, return the form with the entered email kept (the password is not kept). On successful login, reset the rate limiter's `email:` key
- [ ] **Step 4:** `bun test` → PASS, `bun run typecheck` → no errors
- [ ] **Step 5: Commit** `feat(poc): Add session-based auth with Argon2id and rate limiting`

---

### Task 4: Basic resume fields (view, edit) and display components

**Files:**
- Create: `poc/src/resume/validation.ts`, `poc/src/resume/routes.tsx`, `poc/src/views/resume-view.tsx`, `poc/src/views/forms.tsx`, `poc/test/resume.test.ts`
- Modify: `poc/src/app.ts`, `poc/public/app.css`

**Interfaces:**
- Consumes: `requireAuth`, `signupAndLogin` (Task 3), `ResumeRepository`, `POSITIONS`, `positionClass` (Task 2)
- Produces:
  - `type Validation<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string>; values: Record<string, string> }`
  - `validateResumeInput(form: Record<string, string>): Validation<ResumeInput>`. Form field names: `full_name`, `skills` (one per line), `certifications` (one per line), `self_pr`. Empty lines are dropped
  - `ResumeView(props: { resume: Resume; projects: Project[] }): JSX` (the same component is used for `/resume` and `/r/:token`)
  - `ProjectCard(props: { project: Project }): JSX`, `TechIcon(props: { name: string }): JSX`, `PositionBadge(props: { position: Position }): JSX`
  - `formatPeriod(startYm: string, endYm: string | null): string` (`"2023-04", null` → `"2023/04 – 現在"`)
- Limits: `full_name` 1–100, `skills` up to 50 items of 50 characters each, `certifications` up to 50 items of 100 characters each, `self_pr` 4000 characters

- [ ] **Step 1: Write the failing tests** (`test/resume.test.ts`)
  - `GET /resume` for a user with no resume → 200, body contains 「まだ経歴書がありません」 (no resume yet) and a link to `/resume/edit`
  - POST `/resume/edit` (`full_name=山田 太郎`, `skills="設計\nマネジメント"`) → 303 to `/resume/edit`. The body of `GET /resume` contains 「山田 太郎」, 「設計」, and 「マネジメント」
  - Empty `full_name` → 422, body contains 「氏名を入力してください」 (please enter your name), and the other entered values are kept
  - `full_name=<script>alert(1)</script>` → the body of `GET /resume` contains `&lt;script&gt;` and does not contain `<script>alert(1)` (Review Focus 2)
  - `formatPeriod("2023-04", null)` is `"2023/04 – 現在"`, `formatPeriod("2016-04", "2020-12")` is `"2016/04 – 2020/12"`
  - `GET /resume/edit` when not logged in → 302 to `/login`
- [ ] **Step 2:** `bun test test/resume.test.ts` → FAIL
- [ ] **Step 3: Implement.** `ResumeView` follows the order in mockup v2 (name → skills → certifications → self-PR → work experience). Project cards stack labels and values vertically, in the order period, company, project name, responsibilities (line breaks preserved with CSS `white-space: pre-wrap`), technologies, positions. Until Task 6, `TechIcon` is only a text badge (replaced with icons in Task 6). Position colors go in `app.css` as `pos-*` classes
- [ ] **Step 4:** `bun test` → PASS, `bun run typecheck` → no errors
- [ ] **Step 5: Commit** `feat(poc): Add resume viewing and editing`

---

### Task 5: Adding, editing, and deleting work experience entries (one project each) (htmx)

**Files:**
- Modify: `poc/src/resume/validation.ts`, `poc/src/resume/routes.tsx`, `poc/src/views/forms.tsx`
- Test: `poc/test/projects.test.ts`

**Interfaces:**
- Consumes: everything from Task 4, `isHtmx` (Task 1)
- Produces:
  - `validateProjectInput(form: Record<string, string | string[]>): Validation<ProjectInput>`. Form field names: `start_ym`, `end_ym` (empty = present), `company`, `project_name`, `duties`, `technologies` (comma-separated), `positions` (checkboxes; multiple with the same name)
  - Routes (all behind `requireAuth`):

    | Method and path | With htmx | Without htmx |
    | --- | --- | --- |
    | `POST /resume/projects` | 200, HTML of `#projects` (the list) | 303 → `/resume/edit` |
    | `GET /resume/projects/:id/edit` | 200, edit form for that card | 200, edit form page |
    | `POST /resume/projects/:id` | 200, HTML of `#projects` | 303 → `/resume/edit` |
    | `POST /resume/projects/:id/delete` | 200, HTML of `#projects` | 303 → `/resume/edit` |
    | Validation error | 422, form with the errors and entered values kept | 422, page with the same form |
    | Another user's, or nonexistent, `:id` | 404 | 404 |

  - The list on the edit page is `<section id="projects">`. Forms have both `hx-post` and a regular `action` / `method="post"` (they work without JS)
  - When a user with no resume yet adds a work experience entry, create an empty resume with `ensureForUser`
- Limits: `company` and `project_name` 1–100, `duties` 4000, `technologies` up to 30 items of 50 characters each, `positions` only from `POSITIONS`. `start_ym` is required and matches `^\d{4}-(0[1-9]|1[0-2])$`; `end_ym` is empty or the same format and not earlier than `start_ym`

- [ ] **Step 1: Write the failing tests** (`test/projects.test.ts`)
  - Add two entries (`2021-01` and `2023-04`) → in `GET /resume`, `2023/04` appears before `2021/01`
  - Add with `HX-Request: true` → 200, body starts with `<section id="projects"` (does not contain `<html`)
  - `positions=EM&positions=Tech Lead` → both badges appear. `positions=CEO` → 422
  - `start_ym=2024-13` → 422, body contains 「年月の形式」 (year-month format) and the entered value `2024-13` (Review Focus 4)
  - `start_ym=2024-05&end_ym=2024-04` → 422, body contains 「終了は開始より後」 (end must be after start)
  - With user B's cookie, `GET /edit`, `POST`, and `POST /delete` on user A's entry `:id` → all 404, and A's entry is unchanged (Review Focus 1)
  - Delete → removed from the list
- [ ] **Step 2:** `bun test test/projects.test.ts` → FAIL
- [ ] **Step 3: Implement** (per the route table and form field names. Read forms with `c.req.parseBody({ all: true })`)
- [ ] **Step 4:** `bun test` → PASS, `bun run typecheck` → no errors
- [ ] **Step 5: Commit** `feat(poc): Add project entries with htmx partial updates`

---

### Task 6: Technology icons (simple-icons) and input suggestions

**Files:**
- Create: `poc/src/icons/index.ts`, `poc/src/icons/routes.ts`, `poc/test/icons.test.ts`
- Modify: `poc/src/views/resume-view.tsx` (`TechIcon`), `poc/src/views/forms.tsx` (suggestions), `poc/src/app.ts`

**Interfaces:**
- Consumes: `TechIcon` props (Task 4), the `technologies` input (Task 5)
- Produces:
  - `type IconInfo = { slug: string; title: string; hex: string; path: string }`
  - `normalizeTechName(name: string): string` (lowercases, `+`→`plus`, `.`→`dot`, `&`→`and`, removes non-alphanumerics)
  - `resolveIcon(name: string): IconInfo | null` (looks up by both slug and normalized title)
  - `suggestIcons(query: string, limit = 8): IconInfo[]` (normalized prefix matches first, then substring matches)
  - `iconSvg(icon: IconInfo): string` (`<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>…</title><path fill="#<hex>" d="…"/></svg>`. The title is escaped)
  - `GET /icons/:file` (`<slug>.svg`. 404 if missing. `content-type: image/svg+xml`, `cache-control: public, max-age=86400`)
  - `GET /icons/suggest?technologies=<entire input>` (suggests based on the word after the last comma. `<ul>` HTML. Requires login)
  - `TechIcon`: if an icon exists, `<img src="/icons/<slug>.svg" alt="<name>" title="<name>">` plus the name; otherwise a text badge
- Load simple-icons with `import * as icons from "simple-icons"`, putting the exports starting with `si` into a table only once at startup

- [ ] **Step 1: Write the failing tests**
  - `resolveIcon("TypeScript")?.slug === "typescript"`, `resolveIcon("Node.js")?.slug === "nodedotjs"`, `resolveIcon("C++")?.slug === "cplusplus"`, `resolveIcon("社内フレームワーク") === null`
  - `suggestIcons("type")[0].slug === "typescript"`
  - `GET /icons/typescript.svg` → 200, `image/svg+xml`, body contains `fill="#3178C6"` (match the case of the simple-icons value)
  - `GET /icons/nope.svg` → 404
  - A work experience entry with `technologies=TypeScript, 社内フレームワーク` → `GET /resume` contains `src="/icons/typescript.svg"` and a text badge 「社内フレームワーク」 (in-house framework)
  - `GET /icons/suggest?technologies=Go, Type` (logged in) → body contains `TypeScript`
- [ ] **Step 2:** `bun test test/icons.test.ts` → FAIL
- [ ] **Step 3: Implement.** Showing suggestions: the `technologies` input gets `hx-get="/icons/suggest" hx-trigger="keyup changed delay:200ms" hx-target="#tech-suggest"`, with `<ul id="tech-suggest">` below it (shows the correct spelling with icons. No insertion on click, to avoid writing inline JS)
- [ ] **Step 4:** `bun test` → PASS, `bun run typecheck` → no errors
- [ ] **Step 5: Commit** `feat(poc): Show technology icons from simple-icons`

---

### Task 7: Share links

**Files:**
- Create: `poc/src/share/routes.tsx`, `poc/test/share.test.ts`
- Modify: `poc/src/app.ts`, `poc/src/views/layout.tsx` (link to the share page)

**Interfaces:**
- Consumes: `generateToken`, `hashToken` (Task 3), `ShareLinkRepository` (Task 2), `ResumeView` (Task 4)
- Produces:
  - `GET /resume/share` (requireAuth): the status (「共有中」 (sharing) / 「共有していません」 (not sharing)) and buttons: 「作る」 (create), or 「作り直す」 (recreate) and 「止める」 (stop)
  - `POST /resume/share` (requireAuth): `replace` with a new token and show the full `<origin>/r/<token>` **only in this response** (200). If there is no resume, 422 「先に経歴書を作ってください」 (create your resume first)
  - `POST /resume/share/delete` (requireAuth): `delete`, then 303 → `/resume/share`
  - `GET /r/:token`: look up with `hashToken` and return `ResumeView`. Headers `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`. `<meta name="robots" content="noindex">` in the HTML. Missing and invalid tokens get the same 404 body. No login required, and no editing components or logout form are shown

- [ ] **Step 1: Write the failing tests**
  - Create → extract `/r/<token>` from the body, `GET` it without logging in → 200, the name appears, and the three headers are set
  - Recreate → the old URL is 404, the new URL is 200
  - Stop → that URL is 404, and `GET /resume/share` shows 「共有していません」
  - The 404 for a nonexistent token and the 404 for an old, recreated token have the same body
  - `share_links.token_hash` in the DB does not equal the token in the URL
  - The share page of a resume with `<script>` in the responsibilities → escaped (Review Focus 2)
  - A user with no resume creates one → 422
- [ ] **Step 2:** `bun test test/share.test.ts` → FAIL
- [ ] **Step 3: Implement** (per the Interfaces above)
- [ ] **Step 4:** `bun test` → PASS, `bun run typecheck` → no errors
- [ ] **Step 5: Commit** `feat(poc): Add revocable share links`

---

### Task 8: README and end-to-end check

**Files:**
- Create: `poc/README.md`

- [ ] **Step 1:** Write in `README.md`: purpose (one paragraph, linking to the design doc), prerequisites (Bun 1.4.4, the PATH note), `bun install` → `bun run dev` → `http://localhost:3000`, environment variables (`DB_DRIVER`, `DATABASE_URL`, `PORT`, `SECURE_COOKIES`), the commands for tests and type checking, **how to add another DB** (create an implementation returning `Repositories` in `src/db/<driver>/` and add one line to `src/db/index.ts`), and a description of the directories
- [ ] **Step 2:** `rm -rf node_modules data && bun install && bun test && bun run typecheck` → all succeed
- [ ] **Step 3:** Start `bun run start` and, in the browser, check: sign up → edit the resume → two work experience entries (htmx swaps only the list) → create a share link → open it in an incognito window → recreate → the old URL is 404. Also check that no CSP violations appear in the browser console
- [ ] **Step 4: Commit** `docs(poc): Add the README`
