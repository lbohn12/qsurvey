# qsurvey

A Qualtrics toolkit for research staff working with AI-assisted development.

> **Status:** pre-v0, documentation-first. No runtime code yet. The `docs/` tree is the source of truth for the API surface, permissions, and the catalogue of Qualtrics footguns the SDK will defend against. `spec.md` holds the full EARS requirements. UI-parity fixture harness scaffolding lives at `tests/fixtures/`. The TypeScript SDK and `qsurvey from-pdf` CLI arrive in the next iteration.

## What this is

Three related but independently shippable products, planned in [`spec.md`](./spec.md):

1. **`qsurvey from-pdf`** — a CLI that turns a PDF into a live Qualtrics survey in one command.
2. **`qsurvey` SDK** — a typed TypeScript client library with a **schema-as-code + verify** orientation on top of either raw HTTP or a Qualtrics MCP server.
3. **Branded portal layer** — a hosted v2 wrapping `qsurvey`-managed surveys in researcher-controlled public portals.

The CLI depends on the SDK. The portal depends on the SDK. The SDK stands alone.

## Why this exists

The Qualtrics API is a land of silent-failure bugs that the editor hides from you. Specific bugs this toolkit exists to prevent, documented in [`docs/gotchas.md`](./docs/gotchas.md):

- **`?Q_R=<id>&Q_R_DEL=1` wipes completed responses** when applicants click reminder-email links after submitting.
- **In-page display logic writes to `InPageDisplayLogic`, not `DisplayLogic`** — two separate fields, editor reads both, runtime reads one. Writing to the wrong one is a silent-failure bug that passes every visual check.
- **Piped question references (`${q://QID.../…}`) render empty in workflow emails** intermittently, so To addresses and URL parameters silently become blank and drop.
- **Legacy Email Triggers (Survey Tools → Actions) fail silently** after Qualtrics platform updates.
- **`ForceResponse` drops on some update calls** even when sent in the payload, revealing itself only in a verify pass.
- **`BallotBoxStuffingPrevention`** is the actual lever for preventing post-submit resubmission, not the flow-level branch guards the obvious patterns suggest.

The author hit every one of these on a production grant-application portal I built and ran. This toolkit exists so the next researcher doesn't have to.

## Start here

- **New to the Qualtrics API?** Read [`docs/authentication.md`](./docs/authentication.md) first.
- **Got an `insufficient permissions` or 403 error?** [`docs/permissions-and-scopes.md`](./docs/permissions-and-scopes.md) maps every endpoint to the exact user permission or OAuth scope required.
- **Need to ask your brand admin for access?** Copy the email template in [`docs/request-for-permissions.md`](./docs/request-for-permissions.md).
- **Building against Qualtrics and want to avoid known traps?** Read [`docs/gotchas.md`](./docs/gotchas.md) before anything else.
- **Configuring display logic?** [`docs/display-logic.md`](./docs/display-logic.md) is mandatory reading.
- **Using an MCP server for dev?** [`docs/mcp-dev-setup.md`](./docs/mcp-dev-setup.md).
- **Want the full requirements?** [`spec.md`](./spec.md) — EARS specifications for all three products plus the fixture harness.

## Comparison vs other Qualtrics packages

As of April 2026:

| Package | Survey-builder surface | Actively maintained | Typed / type-safe | Verify round-trip | Gotcha docs | MCP-compatible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Jaseibert/QualtricsAPI](https://github.com/Jaseibert/QualtricsAPI) | Partial | Low activity | Python, partial | No | No | No | Response-ingest focused |
| [Baguage/pyqualtrics](https://github.com/Baguage/pyqualtrics) | Partial | Low activity | Python, partial | No | No | No | Panels + responses + distributions |
| [matomatical/qualtrics](https://github.com/matomatical/qualtrics) | Yes (closest to qsurvey's scope) | Not maintained | No | No | No | No | Survey Builder wrapper; stale |
| [cwade/py_qualtrics_api](https://github.com/cwade/py_qualtrics_api) | Partial | Low activity | Python, partial | No | No | No | Core surveys + responses |
| [pytrics](https://pypi.org/project/pytrics/) | Survey building | Not maintained | Python | No | No | No | MIT license |
| [yrvelez/qualtrics-mcp-server](https://github.com/yrvelez/qualtrics-mcp-server) | Via tool calls | Community, active | N/A — MCP tool schemas | No | No | Native (MCP) | 53 tools across 8 domains; complements but doesn't replace an SDK |
| Qualtrics official MCPs | Yes (per-API auto-generated) | Official | Per-endpoint | No | No | Native (MCP) | Requires enterprise scopes; see [`docs/mcp-dev-setup.md`](./docs/mcp-dev-setup.md) |
| **`qsurvey`** (planned) | Yes | Yes | **Yes (TypeScript strict)** | **Yes (verify + fixture harness)** | **Yes** | **Yes (transport-pluggable)** | Schema-as-code, UI-parity tested, footgun-aware |

## Dev setup

For local development, this repo ships with a Qualtrics MCP server config so contributors (and Claude Code / Cursor sessions inside the repo) can hit live APIs without building an HTTP client first.

1. Copy `.env.example` to `.env` and fill in `QUALTRICS_DEV_TOKEN` and `QUALTRICS_DATA_CENTER`.
2. Restart your MCP client (Claude Code: re-open the project, or run `/mcp` and confirm the `qualtrics` server is connected).
3. See [`docs/mcp-dev-setup.md`](./docs/mcp-dev-setup.md) for troubleshooting.

Note: the MCP server exposes CRUD-style tools over the Qualtrics API. It does NOT surface `InPageDisplayLogic`, flow branch builders, `BallotBoxStuffingPrevention` defaults, or Modern Workflow editing. Those gaps are exactly what the SDK fills — see [`docs/gotchas.md#why-qsurvey-exists-on-top-of-mcp`](./docs/gotchas.md#why-qsurvey-exists-on-top-of-mcp).

## Repository layout

```
qsurvey/
├── README.md                      ← you are here
├── spec.md                        ← EARS requirements (4 specs: CLI, SDK, portal, fixture harness)
├── .mcp.json                      ← MCP server config for dev
├── .env.example                   ← env-var scaffolding
├── docs/
│   ├── README.md                  ← docs tree overview
│   ├── authentication.md
│   ├── permissions-and-scopes.md  ← endpoint-to-permission matrix
│   ├── request-for-permissions.md ← email template for your brand admin
│   ├── survey-platform.md         ← surveys, blocks, questions, flow
│   ├── workflows.md               ← Modern Workflow basics
│   ├── distributions.md           ← anonymous links, mailing-list distribution
│   ├── responses-and-exports.md   ← three-step async export pattern
│   ├── runtime-scope-checks.md    ← 403 enrichment + qsurvey doctor
│   ├── directory.md               ← XM Directory / contacts
│   │
│   ├── gotchas.md                 ← the footgun atlas (LEAD WITH THIS)
│   ├── display-logic.md           ← InPageDisplayLogic vs DisplayLogic
│   ├── workflow-emails.md         ← reliable workflow email patterns
│   ├── survey-protection.md       ← resubmission-prevention lever matrix
│   ├── idempotent-sync.md         ← verify-then-update pattern
│   ├── choice-fields.md           ← scaffolding fields the UI writes
│   ├── mcp-dev-setup.md           ← Qualtrics MCP server install
│   │
│   └── examples/ts/               ← runnable TypeScript examples (01–14)
│
└── tests/
    ├── ui-parity.test.ts          ← fixture harness (stub, ships with SDK v0)
    └── fixtures/
        ├── README.md              ← how to regenerate fixtures
        ├── field-classification.json
        └── ui-snapshots/          ← UI-saved question payloads
```

## Contributing

Not yet open for external contributions. The project is pre-v0; the author is building the foundation and stabilising the spec.

If you hit a Qualtrics bug that isn't in [`docs/gotchas.md`](./docs/gotchas.md), opening an issue describing it is welcome — every new gotcha gets documented before it gets fixed in code.

## See also

- [Qualtrics API documentation](https://api.qualtrics.com/) — official reference
