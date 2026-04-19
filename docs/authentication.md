# Authentication

Qualtrics has two distinct authentication models. The `qsurvey` SDK and CLI will support both, and the ergonomics of getting scope/permission wrong are very different between them, so knowing which one you have matters.

- **Personal API token** — one token per user, generated in the user's own Account Settings. Authorizes as *that user*. Capability is controlled by the **user permissions** (checkboxes) set on the user, group, and division by a brand admin. Most research staff use this model.
- **OAuth 2.0 client credentials** — one client per integration, provisioned by a brand admin. Authorizes as an application. Capability is controlled by explicit **OAuth scope** strings (`read:surveys`, `manage:all`, etc.) attached to the client. Used for server-to-server integrations.

If you are not sure which you have: if you copy-paste a single long string out of Account Settings → Qualtrics IDs, you have a personal API token. If you run an OAuth dance to exchange a client ID + secret for an access token, you have OAuth.

> Both models talk to the same endpoints. The difference is which header you send and which way failures present themselves.

## Personal API tokens

### Generating a token

1. Log into Qualtrics.
2. Click your avatar → **Account Settings**.
3. Open the **Qualtrics IDs** tab.
4. In the **API** panel, click **Generate Token**. If a token already exists and you cannot rotate it yourself, you need a brand admin to regenerate.
5. Copy the token immediately. You cannot view it again after closing the page — only regenerate.

> The brand admin must have turned on the **Access API** user permission for your user (or for a group or division you belong to). If the API panel is missing or disabled, that is the reason. Hand your admin [`request-for-permissions.md`](./request-for-permissions.md).

### Using the token

Send the token in the `X-API-TOKEN` header on every request:

```http
GET /API/v3/whoami HTTP/1.1
Host: {datacenter}.qualtrics.com
X-API-TOKEN: your-token-here
```

Never put the token in a query string (it will be logged in server and proxy access logs). Never commit it to a repo. Never print it in CLI output or logs, even with `--verbose` — this is REQ-2.15 and REQ-2.21.

### Capability

A personal API token has exactly the permissions of the user that minted it. There is no separate "scope" concept on top of it — if the user can do something in the Qualtrics UI, the token can do it via the API. If the user cannot, the token gets a 403 (or sometimes a 400 that is really a 403 in disguise). This is why the [`permissions-and-scopes.md`](./permissions-and-scopes.md) matrix matters: it maps every API endpoint to the specific admin-UI permission checkbox that gates it.

## OAuth 2.0 client credentials

### Provisioning a client

A brand admin creates the client in **Admin → OAuth Clients** (sometimes shown as "OAuth Configuration"). They select:

- **Grant type:** Client Credentials (for server-to-server) or Authorization Code (for apps that act on behalf of a logged-in user).
- **Scopes:** a space-separated list of capability strings. See [`permissions-and-scopes.md`](./permissions-and-scopes.md) for the full list; common choices are `read:surveys`, `manage:surveys`, `read:survey_responses`, `manage:survey_responses`, `read:users`, and — as a blunt instrument — `manage:all`.

> **Known quirk:** the fine-grained scopes (`read:surveys`, `manage:surveys`) sometimes return 403 `insufficient_scope` on endpoints the docs say they should cover. Adding `manage:all` to the client unblocks them. This is a Qualtrics-side gap, not a bug in your code. If you are building a tightly scoped integration and cannot tolerate `manage:all`, expect to iterate.

### Exchanging credentials for a token

```http
POST /oauth2/token HTTP/1.1
Host: {datacenter}.qualtrics.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(clientId:clientSecret)}

grant_type=client_credentials&scope=read:surveys manage:survey_responses
```

The response contains an `access_token` valid for one hour. Cache and refresh proactively.

### Using the access token

```http
GET /API/v3/surveys HTTP/1.1
Host: {datacenter}.qualtrics.com
Authorization: Bearer {access_token}
```

OAuth access tokens go in the `Authorization: Bearer` header, not `X-API-TOKEN`.

## Data-center routing

Every Qualtrics brand is hosted in a specific data center (`iad1`, `fra1`, `syd1`, `sjc1`, etc.). Every request URL must include that data-center ID:

```
https://{datacenter}.qualtrics.com/API/v3/{path}
```

### Discovering your data center

- **Admin UI:** Account Settings → Qualtrics IDs → User → Datacenter ID.
- **From a survey ID:** the first two characters of a Qualtrics survey ID do *not* encode the data center (they are always `SV_`). Ignore anyone who tells you otherwise.
- **From a login URL:** the subdomain of the URL you log into Qualtrics at is usually (but not always) the data-center ID. `yourorg.iad1.qualtrics.com` → `iad1`.

If you send a request to the wrong data center, Qualtrics returns a redirect or a 401, depending on the endpoint. Both are confusing; it is worth validating the data center at startup (REQ-2.24).

> Per Spec 2 design note line 203: `qsurvey` does not hide data centers from users. Making them implicit is how you ship surprises.

## Rate limits

Qualtrics enforces per-brand concurrency and per-minute request limits. The exact numbers depend on your enterprise contract; typical defaults are:

- **Concurrency:** 5 simultaneous in-flight requests per brand.
- **Per-minute:** varies; check `X-RateLimit-Limit` and `X-RateLimit-Remaining` on any response.

When you are rate-limited, Qualtrics returns **HTTP 429** with a `Retry-After` header (seconds to wait). The SDK (REQ-2.18) will either retry automatically with exponential backoff or throw a `RateLimitError` exposing `Retry-After`, configurable per client. Response-export polling (see [`responses-and-exports.md`](./responses-and-exports.md)) is the most common place to hit rate limits; space your poll interval to respect them.

## Security notes

- Tokens are secrets. Store them in the environment (`QUALTRICS_API_TOKEN`, REQ-1.6) or in a `.qsurveyrc` file that is **gitignored**.
- Rotate personal tokens if a laptop with `.qsurveyrc` is lost. OAuth clients can be revoked by a brand admin.
- The SDK will redact tokens from all log output, including `--verbose` debug logs (REQ-1.15, REQ-2.15, REQ-2.21).
- `.qsurveyrc` file format is TBD for v0; assume JSON or TOML and assume the SDK will refuse to read it if permissions are world-readable on disk.

## Dev-only tokens for the MCP server

For local development, the repo ships with an MCP server config (see [`mcp-dev-setup.md`](./mcp-dev-setup.md)) that expects a separate `QUALTRICS_DEV_TOKEN` env var. Rationale:

- If the MCP tool misbehaves (a wrong prompt causes an unwanted write), you can revoke just the dev token without disrupting prod work.
- You can point the dev token at a sandbox brand or sandbox survey while `QUALTRICS_API_TOKEN` points at prod.
- Token rotation per contractor or per laptop is cleaner.

See `.env.example` in the repo root. The token goes in `.env`, which is gitignored.

## See also

- [`permissions-and-scopes.md`](./permissions-and-scopes.md) — endpoint-by-endpoint mapping to user permissions and OAuth scopes.
- [`runtime-scope-checks.md`](./runtime-scope-checks.md) — how the SDK will surface permission gaps to callers at runtime.
- [`request-for-permissions.md`](./request-for-permissions.md) — email template to send to a brand admin.
- [`mcp-dev-setup.md`](./mcp-dev-setup.md) — Qualtrics MCP server configuration for local development.
