# Runtime scope checks (unimplemented design note)

This doc specifies how the `qsurvey` SDK and CLI will surface permission and scope gaps at runtime. It is a **design note, not a description of shipping behavior** — the SDK code that implements this arrives in the next iteration. This doc is the contract that code will be written against.

The user-facing goal: when a Qualtrics call fails because a token is under-scoped, the error message should tell the caller exactly which user permission or OAuth scope is missing, and where to click to fix it. Nobody should ever again lose a week to "HTTP 403: insufficient_permissions" with no further information.

## Three layers

### 1. Startup preflight (the SDK)

On client construction, the SDK calls `GET /API/v3/whoami` once. This endpoint requires no permission (see [`directory.md`](./directory.md#get-whoami)). The returned `permissions` object is cached on the client and used to:

- Enrich subsequent 403 errors (see layer 2).
- Answer `client.capabilities()` — a typed method that returns an object like `{ surveys: "full", responses: "read-only", workflows: "none", directory: "none" }` derived from the cached permissions.
- Short-circuit obviously-impossible calls before hitting the wire, if `client.config.failFastOnMissingPermission` is true (off by default; the Qualtrics-side permission model is subtle enough that whitelist-only checks cause false negatives).

The preflight call is skipped when:
- The client is constructed with `{ preflight: false }` (useful in tests).
- The token is an OAuth access token rather than a personal token — `whoami` on OAuth returns a different, less informative shape, so capability mapping is OAuth-scope-based instead (from the token response's `scope` field).

### 2. 403 enrichment (the SDK)

When any request returns HTTP 403, the SDK does not throw the raw Qualtrics message. Instead it:

1. Identifies the endpoint from the request URL.
2. Looks up the expected permission in a static table that mirrors [`permissions-and-scopes.md`](./permissions-and-scopes.md).
3. Cross-references against the cached `whoami` permissions (personal token) or the token's granted scopes (OAuth).
4. Throws a typed `InsufficientPermissionError` whose message names:
   - The endpoint that failed, with method and path.
   - The specific user permission (e.g., "Manage Workflows Across Projects") or OAuth scope that is likely missing.
   - A one-line remediation: "Ask your brand admin to enable this permission. See docs/request-for-permissions.md."
   - The raw Qualtrics response body, at the bottom, for debugging edge cases.

Per Spec 2 REQ-2.16 and REQ-2.17, the error is a typed exception in the SDK's error hierarchy:

```ts
class InsufficientPermissionError extends AuthorizationError {
  readonly endpoint: string;       // "GET /workflows"
  readonly missingPermission: string;  // "Manage Workflows Across Projects"
  readonly missingScope?: string;  // "manage:workflows" or "manage:all" on OAuth
  readonly remediationDoc: string; // Relative path to request-for-permissions.md
  readonly rawResponse: string;    // Original Qualtrics body
}
```

### 3. `qsurvey doctor` (the CLI)

A diagnostic command that any Qualtrics user can run when an API call fails. It:

1. Reads `QUALTRICS_API_TOKEN` and `QUALTRICS_DATA_CENTER` (with `.qsurveyrc` fallback per REQ-1.10).
2. Calls `whoami`.
3. Issues one representative read against each covered area: `/surveys?pageSize=1`, `/workflows?pageSize=1`, `/directories`, and a response-export preflight check.
4. Prints a capability matrix:

```
qsurvey doctor — Qualtrics token capability check

user:         Jordan Rivera (UR_abc123)
brand:        acme
datacenter:   iad1

Access API                               ✅
Survey Platform (create, edit, activate) ✅
Response export                          ✅ (View Response Data, Download Response Data)
Distributions                            ⚠️  (Distribute Surveys off — docs/permissions-and-scopes.md#distributions)
Workflows                                ❌  (Manage Workflows Across Projects off — send docs/request-for-permissions.md)
XM Directory                             ❌  (Access XM Directory off — send docs/request-for-permissions.md)

3/6 areas available. 2 require brand-admin action.
```

The exit code is `0` if every area probed succeeds, `1` if any are missing, following REQ-1.22's structured-error principle.

When the `--json` flag is set (REQ-1.23), the same information is emitted as newline-delimited JSON for automation agents:

```json
{"area": "workflows", "ok": false, "missingPermission": "Manage Workflows Across Projects", "doc": "docs/request-for-permissions.md"}
```

## Non-goals for this design

- **Not a policy engine.** The SDK does not try to enforce fine-grained authorization client-side. Qualtrics is the source of truth. The SDK only *explains* what Qualtrics rejected.
- **Not a schema cache beyond one call.** `whoami` is called once per client, not refreshed on every error. If an admin flips a permission mid-session, the cache is stale — but a second preflight on every 403 would double the request volume for a marginal win.
- **Not OAuth consent flow.** The SDK does not initiate OAuth flows; it consumes tokens the caller already has.

## Test shape (REQ from Spec 2 testing section)

When this code ships, its tests must include:

1. `whoami` preflight succeeds and capabilities are populated.
2. `whoami` preflight fails (token invalid) and the SDK throws `AuthenticationError` before any other call is made.
3. A simulated 403 on `/workflows` produces `InsufficientPermissionError` whose `missingPermission` string equals "Manage Workflows Across Projects".
4. `qsurvey doctor` against a token missing three permissions lists exactly those three, not more.
5. `qsurvey doctor --json` output is valid NDJSON with one object per area.

Use a test token with limited permissions as a manual-test fixture. Confirm that `qsurvey doctor` reports denied access for the areas the token cannot use.

## Additional checks to consider

In addition to permission/scope probes, `qsurvey doctor` shall check a small set of survey-options and workflow-state invariants and warn on deviations from safe defaults:

1. **`BallotBoxStuffingPrevention` state.** If a survey has `SaveAndContinue: "true"` but `BallotBoxStuffingPrevention: "false"`, warn: "Respondents can silently re-submit by clicking a resume link after submitting. Enable Prevent Multiple Submissions in Survey Options → Security. See docs/survey-protection.md." Per `spec.md` REQ-2.36.

2. **Destructive `--clean` guard.** When the CLI is invoked with `--clean` against a survey ID, `qsurvey doctor` shall check whether the survey has any active Modern Workflows (`GET /workflows?surveyId=…`). If any are present, refuse `--clean` unless `--force` is also supplied. Re-seeds destroy QIDs and every workflow that references them breaks silently. See [`idempotent-sync.md`](./idempotent-sync.md) and this guide.

3. **In-page display-logic field-placement check.** For each question with display logic, confirm the rule is in `InPageDisplayLogic` (per [`display-logic.md`](./display-logic.md)) and not `DisplayLogic`. Warn if a rule is placed in the wrong field for its intended mode. Per `spec.md` REQ-2.28.

These checks are advisory — they never block normal SDK operations. They run during `qsurvey doctor` and are surfaced in the verify output (`sdk.verify()` per REQ-2.35).

## Relationship to existing requirements

This design satisfies or sharpens the following `spec.md` requirements:

- **REQ-1.8, REQ-1.9** — missing token / data center. The doctor subcommand explicitly checks these before making any API call.
- **REQ-1.21** — "API access not enabled" detection. Handled by the `whoami` 401 path.
- **REQ-1.22** — structured error output. `InsufficientPermissionError` carries `code`, `message`, and `remediation`.
- **REQ-2.16, REQ-2.17** — typed exceptions with full request/response detail. `InsufficientPermissionError` is a subclass of `AuthorizationError` and carries the raw response.
- **REQ-2.14** — `AuthenticationError` on missing credentials. Thrown from the preflight before any user code reaches an endpoint.
- **REQ-2.35, REQ-2.36** — verify reporting and safe-default protection-option enforcement.
- **REQ-2.28** — in-page display-logic field correctness.
