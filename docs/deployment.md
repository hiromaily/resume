# Deploy the demo on Render

## Current Render environment

The demo is live at [resume-fgud.onrender.com](https://resume-fgud.onrender.com/). The `resume` Blueprint manages the `resume` Web Service on the Free plan and uses [render.yaml](../render.yaml) from `hiromaily/resume` on `main`. Render's Node runtime provides Bun.

| Setting | Value |
| --- | --- |
| Build command | `bun install --frozen-lockfile --production` |
| Start command | `bun run start` |
| HTTP health check | `/login` |
| `BUN_VERSION` | `1.4.4` |
| `DB_DRIVER` | `sqlite` |
| `DATABASE_URL` | `:memory:` |
| `SECURE_COOKIES` | `true` for HTTPS-only session cookies |
| `PORT` | Supplied by Render |
| `TRANSLATOR` | Unset. Claude CLI translation is disabled. |

## Demo accounts

The demo starts with an empty database. From the login page, choose **新規登録** and sign up with an email address and a password of 12 to 128 characters. Use those credentials to log in. Sign up again after a database reset.

## First deploy

1. Push the branch containing `render.yaml` to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), select **New → Blueprint** and choose `hiromaily/resume`. If prompted, grant Render access to that repository.
3. Set the Blueprint name to `resume` and select `main` and the root `render.yaml`. Review the Blueprint and confirm that `resume` is a **Free** Web Service before deploying.
4. Wait until the service is live. Render uses `/login` as its HTTP health check.
5. Open the service's `onrender.com` URL over HTTPS. Use a test account to save a sample resume and check that its share link opens in a private browser window.

Render redeploys when changes reach the linked branch with auto-deploy enabled. If a deploy fails, open the service's **Events** tab and inspect the failed deploy's logs.

## Data lifetime

The demo uses in-memory SQLite. Accounts, resumes, and share links disappear on every restart, redeploy, or idle shutdown. Use sample data. Render Free stops the service after 15 minutes without incoming traffic, and the first request after an idle shutdown can take about a minute. [Render free-tier limits](https://render.com/docs/free)

See [Persist deployment data on Render](deployment-persistence.md) for external database options and the proposed integration.
