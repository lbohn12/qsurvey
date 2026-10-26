# qsurvey

An AI-ready field guide and example scripts for working with the Qualtrics v3 API.

This repository focuses on survey definitions, questions, flow, response exports, distributions, workflows, and XM Directory. It collects practical API patterns and failure modes that are easy to miss when building through scripts or AI coding agents.

> **Status:** documentation and example scripts only. There is no released SDK or CLI in this repository. Some TypeScript files are sketches or stubs. Check [coverage and limitations](./docs/coverage-and-limitations.md) before asking an AI agent to use these notes against a live account.

## Using these notes with an AI agent

1. Start with [coverage and limitations](./docs/coverage-and-limitations.md). This repository does not cover every Qualtrics product, endpoint, license, or permission configuration.
2. Check the specific endpoint in the [official Qualtrics API documentation](https://api.qualtrics.com/) and confirm the needed permissions with your brand administrator.
3. Begin with read-only calls. Use a test survey for writes, then fetch the saved definition and verify behavior through a published survey link.
4. Keep API tokens, real response data, and real survey identifiers out of prompts and committed examples.

## Start here

- [`docs/authentication.md`](./docs/authentication.md) — API tokens, OAuth, and data-center routing.
- [`docs/permissions-and-scopes.md`](./docs/permissions-and-scopes.md) — a best-effort 403 troubleshooting map; verify requirements for your own brand.
- [`docs/gotchas.md`](./docs/gotchas.md) — practical failure modes and workarounds.
- [`docs/display-logic.md`](./docs/display-logic.md) — `DisplayLogic` versus `InPageDisplayLogic`.
- [`docs/workflow-emails.md`](./docs/workflow-emails.md) — piped values, embedded data, and safe resume-link patterns.
- [`docs/responses-and-exports.md`](./docs/responses-and-exports.md) — asynchronous response export workflow.
- [`docs/examples/ts/`](./docs/examples/ts/) — illustrative TypeScript API calls.

## Practical lessons

- The Qualtrics editor and respondent runtime may not behave identically. Confirm API payloads and test the published respondent experience.
- Some API writes may need a follow-up read to confirm the intended fields persisted.
- `Q_R_DEL=1` is for intentional retake-and-replace flows; Qualtrics says the old response is replaced after the retake is submitted. It is not a routine resume-link option. See [Qualtrics' retake-link documentation](https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/retake-survey-link/).
- Permission and scope behavior varies by account. The repository's endpoint matrix includes observations from one tenant and is not authoritative.

## Repository map

- [`docs/`](./docs/) — API notes, pitfalls, setup, and examples.
- [`spec.md`](./spec.md) — design requirements for possible future tooling; these are not implemented features.
- [`tests/fixtures/`](./tests/fixtures/) — fixture-harness design and field classifications. UI snapshots have not yet been captured.

## License

See [`LICENSE`](./LICENSE).
