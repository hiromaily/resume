# Deploy the demo on Render

The [Blueprint](../render.yaml) defines a Free Web Service. Render's Node runtime provides Bun. The build installs production dependencies from the lockfile, and the start command runs the app with Bun. Render supplies `PORT`. The app enables secure session cookies and leaves Claude CLI translation disabled.

## First deploy

1. Push the branch containing `render.yaml` to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), select **New → Blueprint** and choose `hiromaily/resume`. If prompted, grant Render access to that repository.
3. Select `main` and the root `render.yaml`. Review the Blueprint and confirm that `resume-poc` is a **Free** Web Service before deploying.
4. Wait until the service is live. Render uses `/login` as its HTTP health check.
5. Open the service's `onrender.com` URL over HTTPS. Use a test account to save a sample resume and check that its share link opens in a private browser window.

Render redeploys when changes reach the linked branch with auto-deploy enabled. If a deploy fails, open the service's **Events** tab and inspect the failed deploy's logs.

## Data lifetime

The demo uses in-memory SQLite. Accounts, resumes, and share links disappear on every restart, redeploy, or idle shutdown. Use sample data. Render Free stops the service after 15 minutes without incoming traffic, and the first request after an idle shutdown can take about a minute. [Render free-tier limits](https://render.com/docs/free)
