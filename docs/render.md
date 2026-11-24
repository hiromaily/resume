# Render operations with Codex

See [deployment.md](deployment.md) for this project's live URL, Blueprint, environment variables, and first deploy.

## Connect Codex Desktop

1. Open **Plugins → Render → Install** if the plugin is missing. The plugin provides the Render skills and hosted MCP server at `https://mcp.render.com/mcp`.
2. Start a new Codex thread and ask it to list your Render workspaces. Approve the OAuth prompt in the browser.
3. Confirm that `list_workspaces` succeeds. If it returns multiple workspaces, select the one that owns the `resume` service.

If a previously working connection returns HTTP 401, reconnect through OAuth and retry `list_workspaces`. If the plugin loads without exposing Render MCP tools, use the official guide to check the fallback setup. Add a manual MCP entry only if the plugin still leaves MCP unavailable. [Render's Codex Desktop guide](https://render.com/agents/codex-desktop.md)

## Choose how to operate the service

| Task | Tool |
| --- | --- |
| Find the service, inspect deploy history, or read logs and metrics | Render MCP |
| Trigger a new deploy or update environment variables | Render MCP |
| Create a service that should be managed by this repository's Blueprint | Render Dashboard and [render.yaml](../render.yaml) |
| Rename or delete an existing service | Render Dashboard or REST API |

Confirm the workspace and service ID before making a change. The official reference lists which service types and settings the MCP server supports. [Render MCP reference](https://render.com/docs/mcp-server)

## Verify the public URL after creating a service

Render assigns the `onrender.com` hostname when it creates the service. We observed that renaming the service in the dashboard kept its original hostname. Check the assigned URL before sharing it. Render can append a suffix when the requested hostname is already in use.

After a deploy reaches **Live**, open `/login` at the assigned HTTPS URL and verify that it returns HTTP 200. If replacing an old service, check the new service ID and URL in the dashboard so you can tell which deployment you are testing. [Render Web Services](https://render.com/docs/web-services)
