# Switching the resume between Japanese and English (i18n) — Design

> A record of the design at the time. The current spec is [docs/spec.md](../../spec.md); this file is not kept up to date.

Created: 2026-10-31

Prerequisite design: [2026-10-31-resume-app-design.md](2026-10-31-resume-app-design.md) (hereafter "the original design"). This document describes only what it adds to or changes in the original design.

## Intent and background

Some companies require an English resume. So we let the resume's **body text also be kept separately in English**.
The recipient is sent **the same share link**, and **the recipient can switch between Japanese and English** to read it (decided by the user).

If it is written in one language, we want to make it **easy to create and register the version in the other language** (user's request).
The method: **have AI produce a draft, which the person corrects before saving** (decided by the user. Alternatives compared: export, translate elsewhere and import; copy as is).

## Goals

1. The resume body text can be kept separately in Japanese and English
2. On the viewing pages (the shared `/r/:token` and the owner's `/resume`), the viewer can switch between Japanese and English. Switching puts both the UI text, such as headings, and the body text into that language
3. On the edit screen, pressing a button to create a draft from the other language's body text fills the form with an AI-translated draft. The person presses save themselves
4. Translation is abstracted so the implementation can be swapped. **The first implementation to run is the local Claude CLI** (decided by the user). For OpenAI and Amazon Bedrock, only provide an entry point to add them later (candidates named by the user)

## Non-goals

- Languages other than Japanese and English
- The OpenAI and Bedrock implementations themselves
- Translating the UI text of the owner's edit screen, login screen, etc. into English (edit-screen text stays Japanese. The original design's "UI text is Japanese" is relaxed only for the viewing pages)
- Saving drafts automatically, or automatically updating the English when the Japanese is edited (syncing content between the two languages)
- Separate share links per language

## Anti-goals (count as failure even if it works)

- Without a translation implementation configured, the app fails to start, or resumes cannot be edited or viewed
- Translations the person has not checked are silently saved or published
- Content of existing resumes is lost or moved into the English fields
- Adding client JS to call translation (as in the original design, the only client JS is htmx)
- Concerns of a specific translation provider (Claude CLI, etc.) leaking into route or screen code

## Constraints

- Keep the original design and the rules in poc/AGENTS.md as they are (Bun only, htmx only, works without JS, changes only via POST, SQL only inside `src/db/<driver>/`, write tests first, snapshots)
- **Dependencies on external services are allowed only for the translation feature, and only when configured.** The original design's anti-goal "depending on external CDNs or services at runtime" exists so that htmx and icons are served by ourselves. Translation is an add-on feature that is "disabled and shows no button unless configured", which keeps it compatible with that anti-goal (approved by the user on 2026-10-31)
- Using translation **sends the resume body text to the translation provider**. The user has approved this (2026-10-31)
- **The user's DB (`data/app.db`) already contains resumes.** The current schema uses only `CREATE TABLE IF NOT EXISTS` and has no migration tool, so added columns or tables will not be reflected in an existing DB. Make it work against an existing DB too (e.g. add missing columns and tables at startup). Treat existing body text as Japanese. **If you manually run an operation that rewrites the user's `data/`, ask the user first** (poc/AGENTS.md)
- Tests must not call external APIs or the Claude CLI

## Decisions

### Fields kept per language and fields not

| Field | Kept per language? |
| --- | --- |
| Name | Yes (e.g. 山田 太郎 / Taro Yamada) |
| Certifications | Yes (a chip list per language) |
| Self-PR | Yes |
| Work history: company name, project name, duties | Yes |
| Skills, technologies used | No (proper names of technologies; the icon mapping stays as is) |
| Positions | No (already a fixed list in English). But group names (e.g. 「技術のリード」 (Technical leadership)) are translated as UI text |
| Period | No. The displayed 「現在」 (Present) is translated as UI text (`Present` in English) |

- The "yes"/"no" split above is **my (the designer's) decision** (shown to the user, no objection raised)

### Required fields

- **The currently required fields (name, company name, project name) only need to be filled in in either Japanese or English** (decided by the user on 2026-10-31). You can also start writing in English only and create the Japanese via a draft
- The condition for creating a share link (currently "a name is present") follows the same rule: a name in either language is enough
- A work-history entry that exists in only one language becomes a card with empty company and project names on the other language's page. This is accepted as a consequence of "show unfilled fields as they are"
- Handling translations that exceed the character limit is left to the implementer (being stopped by validation on save is sufficient)

### Viewing (the viewer's side)

- Put 「日本語 / English」 (Japanese / English) switch links at the top of the viewing page. Switch with the query `?lang=ja` / `?lang=en` (they are links, so they work without JS)
- Default when `lang` is absent (**my decision**): English if `Accept-Language` prefers English **and an English name is filled in**. Otherwise, the language whose name is filled in (Japanese if both). This avoids first showing a recipient with an English browser an empty resume with only headings
- Headings and labels (「職務経歴」 (Work history), 「会社名」 (Company), 「スキル」 (Skills), etc.), the period's 「現在」, and position group names are shown in the chosen language
- Only **the resume part (body text, headings, labels) and the switch links** are put into English. The shared header (「職務経歴書」 (Resume), 「ログアウト」 (Log out)) and surrounding text on the owner's `/resume` such as 「編集する」 (Edit) and 「共有リンク」 (Share link) stay in Japanese (**my decision**, since only the owner sees the surroundings)
- `<html lang>` is set to the chosen language
- **Fields not written in that language are shown empty** (not filled in with the other language instead. Decided by the user). Whether an empty field's heading is kept or hidden follows the current display (how empty fields are handled now)
- The share page's handling (`noindex`, `no-store`, etc.) and the 404 for invalid tokens stay as they are

### Editing (the owner)

- Edit-screen text stays Japanese
- "Kept per language" fields get separate inputs per language. You can write from either Japanese or English
- The owner's viewing page (`/resume`) can also be switched, so the owner can check how the English version looks

### Creating a draft (translation)

- Put buttons per edit-form unit: the basic-fields form (name, certifications, self-PR) and the form for each work-history entry. Work history is edited one entry at a time via htmx, so this matches the form units (**my decision**)
- **Also put the button on the form for adding a new work-history entry (an entry not yet saved)** (**my decision**; needed for the flow of translating an entry written only in English into Japanese)
- **How the button is presented** (decided by the user on 2026-10-31, because two plain buttons under save were hard to find and gave no sign of working after being pressed):
  - At the **top of each form, a colored bar** 「✨ AI で翻訳の下書き [訳す元 ▾] から [訳す先 ▾] へ [下書きを作る]」 ("✨ AI translation draft from [source ▾] to [target ▾] [Create draft]") (option A shown in the browser)
  - **Languages are chosen with dropdowns, with a single button**, so that adding languages does not add buttons and break the layout (user's request. The data model stays as two languages, Japanese and English). If the same language is chosen for both: 「訳す元と訳す先に別の言語を選んでください」 ("Choose different source and target languages")
  - **While translating**, the button changes to a spinner and 「訳しています…（10 秒ほど）」 ("Translating… (about 10 seconds)"), and the dropdowns, button and save are disabled (only htmx's `hx-indicator` and CSS. No spinning under the reduced-motion setting). Because CSS cannot insert the chosen language name, it does not say 「英語に訳しています」 ("Translating into English") (**my decision**)
  - **When translation finishes**, show a green bar 「下書きを入れました（日本語 → 英語）。確かめて直してから保存してください」 ("Draft inserted (Japanese → English). Check and correct it, then save"), and give the filled fields a green border
  - Because the bar is at the top of the form, put an invisible save button first so that Enter saves
  - Without JS, the in-progress indication is left to the browser's loading indicator (**my decision**)
- Both directions: Japanese → English and English → Japanese (**my decision**)
- Pressing the button makes the server translate the other language's values and return the form with the draft in the target language's inputs. **It does not save.** It is registered only when the person reads it, corrects it and presses save (decided by the user)
- The draft is based on the values currently in the form (including unsaved edits). Values already written in the target are replaced by the draft (since it is not saved, to undo, reopen without saving)
- Without JS, a form submission (POST) returns a page with the same result (the original design's "works without JS")
- When translation fails (provider error, timeout, misconfiguration), show an error message on the form with the entered values preserved

### Translation abstraction

- Have one interface that promises only "translate a set of body-text fields from one language to another". It should not need to know resume field names or screens; provider concerns (CLI arguments, API shapes) stay inside the implementation
- Only one place selects the implementation, by reading an environment variable (e.g. `TRANSLATOR`). Same idea as the DB's `DB_DRIVER` and `src/db/index.ts`: **adding an implementation should only require adding one implementation file and one line at the selecting place**
- If the environment variable is unset, translation is disabled. The draft button is not shown and the draft route cannot be used (if hit, it does nothing and returns an error)
- First implementation: **Claude CLI** (calls `claude -p` as a child process). For running locally. Anyone can sign up, so when enabled, any logged-in user can run the host's CLI. Deployment is a non-goal, so the PoC leaves it as is and notes this as a caution in the docs. It must: disallow tool use, have a timeout, and receive output in a fixed shape (JSON, etc.) and validate it
- OpenAI and Bedrock are not implemented. Their names need not be added to the selecting place (add one line when adding them). Document how to add them in the docs
- Tests use a fake implementation that returns fixed translations

## Left to the implementer

- How to store per-language body text (add columns, a separate table, bundle into JSON) and how to add it to an existing DB. But respect "do not lose existing resume content; treat it as Japanese" above
- Where to put the UI-text dictionary (file split, key names)
- The detailed shape of the translation interface, the prompt and output shape passed to the Claude CLI, the timeout length, and whether to specify a model
- The look and placement of the language switch links, and how to lay out per-language inputs on the edit screen (Japanese and English side by side, or tabs)
- The indication while a draft is being created (htmx `hx-indicator`, etc.)
- How to update the docs (architecture.md, recipes.md, tech-stack.md, the README's environment-variable table). Add the steps for adding a translation implementation to recipes.md
