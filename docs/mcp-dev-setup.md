# MCP setup notes

Model Context Protocol (MCP) servers give Claude Code, Cursor, and other MCP-aware clients direct access to Qualtrics API operations. Qualtrics documents an official MCP server for each API in its public reference. A community server is also available; check its current repository for setup and tool coverage.

## Why an MCP server belongs in this repo

An MCP server can give an AI coding agent access to the API tools configured for the user's Qualtrics account. Use read-only tools first and confirm the server's current tool list and permissions before allowing writes.

MCP tools expose the documented API operations; these notes show additional checks and patterns an AI agent can apply around those calls. This repository does not currently ship a higher-level SDK. See [`coverage-and-limitations.md`](./coverage-and-limitations.md) before treating any example as implemented functionality.

## Option 1: Qualtrics' official MCP

Qualtrics' current API getting-started guide describes MCP servers for the APIs in its public reference. Check the official MCP guide for current setup and availability.

**Pros:**

- Maintained by Qualtrics.
- Based on APIs in the official reference.

**Cons:**

- Tool availability and access depend on your Qualtrics account, license, and brand configuration. See [`permissions-and-scopes.md`](./permissions-and-scopes.md) for best-effort troubleshooting notes.
- Install instructions live behind the Qualtrics developer portal (`api.qualtrics.com`); some URLs require authentication to access.

**Setup — pointer, not instructions:** See the Qualtrics developer portal's MCP overview. If your URL 404s without authentication, you may need an enterprise developer account. Contact your brand admin for access.

If you successfully configure the official server, update `.mcp.json` at the repo root to reference it in place of the community server (see Option 2's config shape).

## Option 2: `yrvelez/qualtrics-mcp-server` (community)

A community-maintained MCP server. Tool coverage and installation steps can change; check its [repository](https://github.com/yrvelez/qualtrics-mcp-server).

**Pros:**

- Check the current project documentation for supported authentication and deployment options.

**Cons:**

- Community-maintained; lags official API changes.
- Check the tools exposed by the server and the official API reference for current coverage. Higher-level survey-as-code helpers in this repository are design notes, not implemented code.

**Setup:**

1. **Create a dev token.** Log into Qualtrics → Account Settings → Qualtrics IDs → API → Generate Token (or use an existing token). Copy it.

2. **Set environment variables.** In your shell, or in `.env` (local to this repo; gitignored):

   ```bash
   export QUALTRICS_DEV_TOKEN=your-personal-token-here
   export QUALTRICS_DATA_CENTER=iad1  # or fra1, syd1, pdx1, etc.
   ```

   See `.env.example` in the repo root. Note: `QUALTRICS_DEV_TOKEN` is separate from `QUALTRICS_API_TOKEN` — the former is for the MCP server's dev use; the latter is for the SDK and CLI when they reach runtime. Point them at a dev/sandbox brand if possible.

3. **Verify the MCP config.** The repo's `.mcp.json`:

   ```json
   {
     "mcpServers": {
       "qualtrics": {
         "command": "npx",
         "args": ["-y", "qualtrics-mcp-server"],
         "env": {
           "QUALTRICS_API_TOKEN": "${QUALTRICS_DEV_TOKEN}",
           "QUALTRICS_DATA_CENTER": "${QUALTRICS_DATA_CENTER}"
         }
       }
     }
   }
   ```

4. **Restart your MCP client.** In Claude Code: close and re-open the project, or run `/mcp` and confirm the `qualtrics` server shows as connected.

5. **Test.** Ask Claude: "list my Qualtrics surveys." The MCP server's `list_surveys` tool should fire and return results.

### Troubleshooting

- **`insufficient_permissions` or 403.** Your token is missing a user permission. Identify which endpoint was called (Claude will usually tell you), cross-reference [`permissions-and-scopes.md`](./permissions-and-scopes.md), and send [`request-for-permissions.md`](./request-for-permissions.md) to your brand admin.
- **Wrong data center / 401.** `QUALTRICS_DATA_CENTER` is wrong. Check Account Settings → Qualtrics IDs → User → Datacenter ID. See [`authentication.md`](./authentication.md#data-center-routing).
- **`command not found: npx`.** Install Node.js 18+.
- **MCP server not showing up after restart.** Check Claude Code's MCP log. Common causes: typo in `.mcp.json`, env vars not exported to Claude Code's parent shell.

## Scoping tokens for dev vs prod

Three token hygiene rules:

1. **Never commit `.env`.** `.env.example` is committed; `.env` is gitignored.
2. **Prefer a dedicated dev token** scoped to a sandbox brand or sandbox survey. If an MCP tool misbehaves, you can revoke just that token without disrupting prod work.
3. **Rotate tokens** when a laptop is lost or a dev leaves. See [`authentication.md`](./authentication.md#security-notes).

## What to use MCP for in dev

- **Exploratory reads.** "What's the current flow for SV_abc? What's the `InPageDisplayLogic` on question QID102?" Faster than scripting a one-off HTTP call.
- **Testing fixture-harness changes.** When you add a new fixture, use the MCP to fetch the UI-saved version from a live survey, save it to `tests/fixtures/ui-snapshots/`, then iterate on the SDK builder until its output matches.
- **Debugging display logic.** When a rule isn't firing, use the MCP to inspect the full question JSON before changing the survey.

## What NOT to use MCP for in dev

- **Running tests.** The fixture harness is deliberately offline (per `spec.md` REQ-4 design notes). Don't make tests depend on MCP availability.
- **Writing against prod surveys.** If `QUALTRICS_DEV_TOKEN` accidentally points at prod, an "oops, please delete that block" sentence in Claude will do real damage. Scope tokens narrowly.
- **Replacing the SDK.** The whole point of the SDK is the layer MCP doesn't cover. Don't dismantle qsurvey because MCP looks like enough — it isn't, and the gaps are exactly the silent-failure zones documented in [`gotchas.md`](./gotchas.md).

## See also

- [`authentication.md`](./authentication.md) — token-handling basics
- [`permissions-and-scopes.md`](./permissions-and-scopes.md) — which permission each tool needs
- [`request-for-permissions.md`](./request-for-permissions.md) — email template for the brand admin
- [`gotchas.md`](./gotchas.md) — why the SDK on top of MCP is still worth building
- [Qualtrics API docs](https://api.qualtrics.com/)
- [`yrvelez/qualtrics-mcp-server` on GitHub](https://github.com/yrvelez/qualtrics-mcp-server)
