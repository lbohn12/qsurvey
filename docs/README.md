# qsurvey docs

Reference notes and examples for a subset of the Qualtrics v3 API. Planned SDK and CLI interfaces described elsewhere are not shipped.

Before using an AI agent to act on these examples, read [coverage and limitations](./coverage-and-limitations.md). These notes do not cover every Qualtrics product or permission configuration, and planned SDK behavior is not implemented code.

This docs set is written before the code. It is the contract the code will implement against, and it is the reference material a human or an AI coding agent should reach for when writing anything that talks to Qualtrics.

## Your token just 403'd — now what?

1. Look up the endpoint in [`permissions-and-scopes.md`](./permissions-and-scopes.md).
2. Note the required **user permission** (for personal API tokens) or **OAuth scope** (for OAuth clients).
3. Compare against what your token actually has:
   - Personal API token: ask your brand admin which checkboxes are enabled on your user, or call `GET /API/v3/whoami` and inspect the `permissions` block on the returned user.
   - OAuth client: inspect the client configuration in the Qualtrics admin UI.
4. If a permission is missing, copy the email in [`request-for-permissions.md`](./request-for-permissions.md), fill it in, and send it to your brand admin.

## Reading order

1. **[`authentication.md`](./authentication.md)** — token types, headers, data-center routing, rate limits.
2. **[`permissions-and-scopes.md`](./permissions-and-scopes.md)** — the matrix. Which permission or scope each endpoint needs.
3. Per-area reference:
   - [`survey-platform.md`](./survey-platform.md) — surveys, blocks, questions, flow, activation.
   - [`responses-and-exports.md`](./responses-and-exports.md) — async export jobs, formats, pagination.
   - [`distributions.md`](./distributions.md) — anonymous links, mailing-list distributions, reminders.
   - [`workflows.md`](./workflows.md) — workflows, events, tasks, run history.
   - [`directory.md`](./directory.md) — XM Directory contacts, lists, transactions.
   - [`embedded-javascript.md`](./embedded-javascript.md) — custom/embedded survey JavaScript (planned; stub).
4. **[`runtime-scope-checks.md`](./runtime-scope-checks.md)** — design note for the SDK's preflight and 403-enrichment behavior (arrives with SDK v0.2).
5. **[`request-for-permissions.md`](./request-for-permissions.md)** — email template for your brand admin.
6. **[`examples/ts/`](./examples/ts/)** — runnable TypeScript snippets, one per common task. Each file names the permissions it requires at the top.

## Conventions

- Endpoints are written as `METHOD /API/v3/{path}` with the data-center host omitted. The real URL is `https://{datacenter}.qualtrics.com/API/v3/{path}` — see [`authentication.md`](./authentication.md) for data-center discovery.
- Qualtrics' own nouns are used exactly: survey, block, question, response, distribution, workflow, directory, contact, mailing list. No invented synonyms. Spec 2 design note line 201 is load-bearing here — LLMs and humans both pattern-match on these names.
- Every example starts with a comment block listing the exact permissions it requires, so you can tell at a glance whether your token can run it.
- When a requirement comes from [`spec.md`](../spec.md), it is cited by REQ-ID (e.g., REQ-2.13).
