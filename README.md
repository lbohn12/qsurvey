# qsurvey

A Qualtrics toolkit for research staff working with AI-assisted development.

> **Status:** pre-v0, documentation-first. No runtime code yet. The `docs/` tree is the source of truth for API surface and permissions; the TypeScript SDK and `qsurvey from-pdf` CLI arrive in the next iteration.

## What this is

Three related but independently shippable products, planned in [`spec.md`](./spec.md):

1. **`qsurvey from-pdf`** — a CLI that turns a PDF into a live Qualtrics survey in one command.
2. **`qsurvey` SDK** — a typed JavaScript/TypeScript client library for the Qualtrics API that is pleasant to read and legible to AI coding agents.
3. **Branded portal layer** — a hosted v2 wrapping `qsurvey`-managed surveys in researcher-controlled public portals.

The CLI depends on the SDK. The portal depends on the SDK. The SDK stands alone.

## Start here

- **New to the Qualtrics API?** Read [`docs/authentication.md`](./docs/authentication.md) first.
- **Got an `insufficient permissions` or 403 error?** Go straight to [`docs/permissions-and-scopes.md`](./docs/permissions-and-scopes.md) — it maps every endpoint to the exact user permission or OAuth scope required.
- **Need to ask your brand admin for access?** Copy the email template in [`docs/request-for-permissions.md`](./docs/request-for-permissions.md).
- **Building tooling against Qualtrics and want runnable examples?** See [`docs/examples/ts/`](./docs/examples/ts/).
- **Want the full requirements?** [`spec.md`](./spec.md) holds the EARS specifications for all three products.

## Why this exists

The author spent a week on the CSSA RFA portal fighting opaque Qualtrics API errors, question ID confusion, data-center routing, and brittle hand-written seed scripts. The worst specific failure: an enterprise API token provisioned with Survey Platform permissions only, hitting generic 403s on `/workflows` endpoints with no hint that the fix was a single checkbox in brand admin. This docs set exists so the next researcher doesn't lose a week to the same wall.

## Contributing

Not yet. The project is pre-v0; the author is building the foundation. Watch the repo if you want to be pinged when v0 ships.
