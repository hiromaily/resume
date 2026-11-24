# Persist deployment data on Render

## Current behavior

The [Render Blueprint](../render.yaml) sets `DB_DRIVER=sqlite` and `DATABASE_URL=:memory:`. Accounts, resumes, and share links are lost when the process exits, including on redeploy, restart, or idle shutdown. Switching to a local SQLite file would still lose data when Render replaces the service filesystem. Persistent disks are available on paid services. Render's Free Postgres expires 30 days after creation. [Render free-tier limits](https://render.com/docs/free) · [Persistent disks](https://render.com/docs/disks)

## External databases with free plans

Keep the Render Web Service on its Free plan and store data in an external database. Render's idle shutdown still affects the first request after inactivity, while database records stay with the external provider.

| Database | Free storage | Changes needed |
| --- | --- | --- |
| Turso Cloud | 5 GB | Add a remote SQLite-compatible driver. Much of the current SQL can be reused. [Turso pricing](https://turso.tech/pricing) |
| Neon Postgres | 1 GB per project, with no time limit on the free plan | Add a PostgreSQL driver and adapt SQLite-specific behavior, including schema upgrades and the `rowid` tie-breaker for work history. [Neon pricing](https://neon.com/pricing) |

Turso is the first option to evaluate for this app because it uses SQLite-compatible SQL. Both providers have usage limits in addition to storage limits.

## Proposed Turso integration

1. Add a remote implementation under `src/db/` that implements [the repository contract](../src/db/ports.ts). Keep `bun:sqlite` as the local development driver. The current driver opens only local SQLite databases, so changing `DATABASE_URL` alone is insufficient.
2. Run the existing [repository contract tests](../test/repository-contract.ts) against the new implementation. Check schema initialization, transactions, and work-history ordering.
3. Configure the new driver and database URL on Render. Store the database token as a secret in the Render Dashboard.
4. If existing records need to be kept, obtain a consistent export while the current process is still running and verify the import before switching. The current in-memory database has no file to copy, and restarting the process loses access to its contents.
5. Verify persistence by creating a test account and resume, recording its share URL, then redeploying and checking that login, the saved resume, and the same share URL still work.
