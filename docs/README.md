# Docs index

Pick the document by what you want to know. Each thing is written in one place only; other documents point there.

| What you want to know | Document |
| --- | --- |
| Technologies and versions, why we chose them, what we deliberately don't use, how to upgrade | [tech-stack.md](tech-stack.md) |
| Directory layout, each file's role, route list, request flow, DB abstraction, auth and security | [architecture.md](architecture.md) |
| How to start, test and debug, and the pitfalls actually hit in this PoC | [development-tips.md](development-tips.md) |
| How-tos for common changes (adding a page, a chip field, a DB, a position, a technology alias) | [recipes.md](recipes.md) |
| How to deploy and verify the demo on Render | [deployment.md](deployment.md) |
| What we build, why, and what was decided (the user's decisions, with dates) | [spec.md](spec.md) |
| Design docs and implementation plans as written at the time (a record of past work; not kept up to date) | [superpowers/](superpowers/) |

The quickest way to start is in [README.md](../README.md). The rules AI agents follow are in [AGENTS.md](../AGENTS.md).

## Rules for editing the docs

- Put **the spec (what and why) in spec.md, the mechanics (how it works) in architecture.md, and procedures in recipes.md**
- If a code change makes a document inaccurate, fix the document in the same commit. The route list (architecture.md) and the version table (tech-stack.md) drift especially easily
- When you hit a pitfall, add it to development-tips.md as "symptom → cause → fix"
