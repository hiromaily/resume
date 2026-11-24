# Spec

What this PoC builds, why, and what was decided. How it works is in [architecture.md](architecture.md), technology choices are in [tech-stack.md](tech-stack.md), and procedures are in [recipes.md](recipes.md).

Each decision is marked with who made it and when: **(user, date)** for decisions the user made, **(designer, date)** for decisions made while designing and shown to the user without objection. When a decision changes, rewrite the entry to the current decision and note the date of the change; do not keep the old text here.

## Purpose

Test **an MPA (Multi-Page Application) built with Bun + Hono + htmx** as a technology choice and architecture that can reduce token cost when AI does the development (user, 2026-10-31).
Build that foundation in `poc/` and put a sample app on it: a resume app for software engineers (register, view, share via a link).

- Measuring the token-cost effect is **out of scope** (it has already been evaluated separately). This PoC confirms that an app can actually be built with this stack, and what shape the foundation takes
- `poc/` is **cut off from outside context**. The parent repository's (car showroom area map) business domain, terminology and rules are not brought in

## Goals

1. A Hono + htmx MPA foundation, self-contained in `poc/`, that runs with `bun install` → `bun run dev`
2. An abstracted DB, so SQLite can be swapped for another DB without changing app code
3. Sample app: sign-up, login, registering and viewing your own resume, and viewing via a share link
4. The resume body text can be kept in Japanese and English, the viewer switches between them, and the other language can be drafted by AI (user, 2026-10-31)

## Non-goals

- Measuring or comparing token cost
- Passkeys (WebAuthn). Keep authentication inside `src/auth/` so they can be added later
- DBs other than SQLite (only the switching point exists)
- CI and production operation
- Share-link expiry, naming individual viewers (e.g. allowing by email address)
- PDF export, multiple resumes per user
- Languages other than Japanese and English
- Translation implementations other than the Claude CLI (OpenAI and Amazon Bedrock were named as candidates; only the entry point to add them exists)
- Translating the edit screen, login screen, etc. into English
- Saving drafts automatically, or syncing content between the two languages (e.g. updating the English when the Japanese is edited)
- Separate share links per language

## Deployment

- Deploy the PoC on Render's free tier (user, 2026-11-24). The demo uses in-memory SQLite and leaves Claude CLI translation disabled.

## Anti-goals (failure even if it works)

- It becomes an SPA (a client-side JS framework or a build step). **The only client JS is htmx**
- Depending on external CDNs or services at runtime. htmx and icons are served from our own server. The one exception is translation, which is an add-on that is disabled and shows no button unless configured (user, 2026-10-31)
- Getting mixed up with the parent repository's workspace, dependencies or configuration
- Sloppy authentication (plaintext passwords, raw tokens in the DB, no CSRF protection)
- Without a translator configured, the app fails to start, or resumes cannot be edited or viewed
- Translations the person has not checked are saved or published
- Content of existing resumes is lost or moved into the English fields
- Concerns of a specific translation provider leaking into route or screen code

## Constraints

- **Runtime and package manager are Bun.** Do not use npm, pnpm or yarn (user, 2026-10-31)
- **Use the latest version (the `latest` dist-tag) of everything**, pinned in `package.json` (user, 2026-10-31). The versions are in [tech-stack.md](tech-stack.md)
- The user's DB (`data/app.db`) already holds resumes. Schema changes must work against an existing DB, and existing body text is treated as Japanese
- Using translation **sends the resume body text to the translation provider** (approved by the user, 2026-10-31)
- Tests must not call external APIs or the Claude CLI

## Decisions

### Technology

- Bun + Hono + htmx MPA. SQLite for now, abstracted so it can be switched (user, 2026-10-31)
- **Server-side sessions, not JWT.** JWT was the initial idea, but for a same-origin MPA, sessions that can be revoked immediately are safer and simpler (proposed by the designer, accepted by the user, 2026-10-31)
- No ORM, query builder, migration tool or validation library, to keep dependencies minimal (designer, 2026-10-31)
- Lint and format with Biome, chosen over Oxc (oxlint + oxfmt) because it needs one tool and one config (user, 2026-10-31)

### Screens

| Path | Content |
| --- | --- |
| `/` | To your own resume if logged in, otherwise to login |
| `/signup` `/login` `/logout` | Account |
| `/resume` | View your own resume (same components as the share page) |
| `/resume/edit` | Edit (basic fields; add, edit and delete each work-history entry) |
| `/resume/share` | Create, regenerate and stop the share link |
| `/r/:token` | Share page (view only) |

Every route, including fragments, is in [architecture.md](architecture.md).

- Page navigation uses ordinary links and forms. htmx is used **only to swap parts** of a page
- **Everything works without JS** (plain form submission returns the full page or a redirect)
- UI text is Japanese, except the resume part of the viewing pages when English is chosen (see "Japanese and English")

### Viewing permission and share links

- Only **permitted people** can see a resume. To start, permission is granted via a **share link** (user, 2026-10-31)
- **Regenerating the link immediately invalidates the old URL** (user, 2026-10-31)
- The owner can create, regenerate and stop the link. A link can be created once a name is filled in, in either language
- The full link can be seen only once, right after creating or regenerating it, because the DB holds only its hash. Regenerate it if needed (designer, 2026-10-31)
- The share page is view-only and is not indexed, cached or leaked via Referer. Invalid and nonexistent tokens both return the same 404

### Resume contents

- Audience: software engineers. One resume per user (user, 2026-10-31)
- Fields: name, work history, skills, certifications, self-PR (user, 2026-10-31)
- **Each work-history entry is one project.** Several projects at the same company are allowed. An entry has: period, company name, project name, duties, technologies used, positions (user, 2026-10-31)
- **Skills are written by the person**, not aggregated from the technologies in the work history (user, 2026-10-31)
- Work history is ordered newest first by start month. **No manual reordering** (designer, 2026-10-31)

### Work-history display

- Entries are stacked vertically, newest first, one card each. Inside a card, label/value pairs are stacked vertically in this order (user, 2026-10-31, from the sample shown in the browser):
  1. Period (`2023/04 – 現在`, where 「現在」 means "Present")
  2. Company name
  3. Project name
  4. Duties (line breaks preserved)
  5. Technologies used, as **icons** so they can be told apart at a glance. A text badge if there is no icon. Icons carry the technology name as `title` and `alt`
  6. Positions, as badges color-coded by group, so they can be recognized at a glance
- Skills are shown as text tags, with an icon when the name matches a technology icon

### Input

- **Period**: year and month dropdowns, years from the current year down to 1970, start and end on one line. `<input type="month">` was hard to use (user, 2026-10-31)
- **「就業中」 (Currently employed)**: checking it makes the end year and month unselectable, and the end is saved as "present". If unchecked, the end is required (user, 2026-10-31)
- **Technologies**: typing shows suggestions from technology icon names; clicking one adds it as a chip (removable with ×) above the input, and the input is cleared for the next term (user, 2026-10-31). The typed term itself is also offered, so technologies without an icon (e.g. AWS) can be added. Common aliases (Golang → Go, k8s → Kubernetes, etc.) map to icons. What is saved is the display name
- **Skills and certifications**: entered with the same chips as technologies (user, 2026-10-31). Skills offer technology suggestions; certifications offer the typed name itself
- **Positions**: picked, possibly several, from a fixed list grouped by area (engineering, infrastructure, operations, data, quality, technical leadership, management, product, design) (designer, 2026-10-31). Picked with a grouped dropdown and shown as chips in the order picked; a row of checkboxes was cluttered (user, 2026-10-31)
- **Validation**: done on the server (types, lengths, year-month format, start ≤ end). On error, the same form comes back with messages and the entered values kept
- **Required fields**: name, company name and project name. Each needs to be filled in **in either Japanese or English** (user, 2026-10-31). Length limits are the same for each language

### Japanese and English

Some companies require an English resume, so the body text can also be kept in English. The recipient gets **the same share link** and **switches between Japanese and English** themselves (user, 2026-10-31).

Fields kept per language (designer, 2026-10-31):

| Field | Per language? |
| --- | --- |
| Name | Yes (e.g. 山田 太郎 / Taro Yamada) |
| Certifications | Yes (a chip list per language) |
| Self-PR | Yes |
| Work history: company name, project name, duties | Yes |
| Skills, technologies used | No (proper names of technologies) |
| Positions | No (the list is already in English). Group names are translated as UI text |
| Period | No. 「現在」 is shown as `Present` in English |

Viewing (`/resume` and `/r/:token`):

- 「日本語 / English」 links at the top switch the language with `?lang=ja` / `?lang=en`
- Default without `lang` (designer, 2026-10-31): English if the browser prefers English **and an English name is filled in**; otherwise the language whose name is filled in (Japanese if both). This avoids showing an English-speaking recipient an empty resume with only headings
- The resume part (body, headings, labels) and the switch links follow the chosen language, as does `<html lang>`. The shared header and the owner-only text around the resume on `/resume` stay Japanese, since only the owner sees them (designer, 2026-10-31)
- **Fields not written in that language are shown empty**, not filled in from the other language (user, 2026-10-31). An entry written in only one language appears on the other language's page with empty company and project names

Editing:

- Per-language fields have one input per language. You can start in either language
- The owner can switch `/resume` too, to check how the English version looks

### AI translation drafts

If a resume is written in one language, the other can be **drafted by AI and corrected by the person before saving** (user, 2026-10-31; chosen over exporting, translating elsewhere and importing, or copying as is).

- A draft can be made in the basic-fields form (name, certifications, self-PR) and in each work-history form, including the form for a new, unsaved entry (designer, 2026-10-31)
- **At the top of each form is a colored bar**: 「✨ AI で翻訳の下書き [訳す元 ▾] から [訳す先 ▾] へ [下書きを作る]」 ("AI translation draft from [source ▾] to [target ▾] [Create draft]"). Two plain buttons under the save button were hard to find (user, 2026-10-31)
- **Languages are picked with dropdowns and there is one button**, so adding languages would not add buttons (user, 2026-10-31). Picking the same language for both shows an error
- **While translating**, the button turns into a spinner with 「訳しています…（10 秒ほど）」 ("Translating… (about 10 seconds)"), and the dropdowns, the button and save are disabled. No spinning when the OS asks for reduced motion (user, 2026-10-31). Without JS, the browser's own loading indicator is all there is (designer, 2026-10-31)
- **When done**, a green bar says 「下書きを入れました（日本語 → 英語）。確かめて直してから保存してください」 ("Draft inserted (Japanese → English). Check and correct it, then save"), and the filled fields get a green border (user, 2026-10-31)
- Pressing Enter in the form still saves, even though the draft bar comes first
- The draft is made from the values currently in the form, including unsaved edits, and replaces what is already in the target language. **It is not saved**; the person reads, corrects and saves it (user, 2026-10-31). To undo, reopen without saving
- If translation fails (provider error, timeout, misconfiguration), the form shows an error and keeps the entered values
- Translation is behind an interface that knows only "translate these texts from one language to another"; adding a provider means adding one implementation and one line where it is selected
- **The only implementation is the local Claude CLI** (user, 2026-10-31). It runs without tools, with a timeout, and its output is validated
- When no translator is configured, translation is disabled: no draft bar, and the draft routes return an error

**Caution**: anyone can sign up, so while translation is enabled, any logged-in user can run the host's Claude CLI with the host's login. The public Render demo leaves translation disabled.

### Separation from the parent repository

- Work on `feat/poc-hono-htmx`, cut from develop. **Do not create a PR, and do not push without asking** (user, 2026-10-31)
- `poc/` is outside the parent's pnpm workspace and CI. The only change to the parent is `"!poc"` in the root `biome.json`, which keeps the parent's lint off `poc/` (designer, 2026-10-31)
