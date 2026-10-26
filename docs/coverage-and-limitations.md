# Coverage and limitations

These notes are a practical field guide, not a complete or authoritative specification of the Qualtrics API. They describe a subset of the v3 REST API, with emphasis on survey definitions, questions, flow, distributions, responses, workflows, and directory operations. Qualtrics has other products and endpoints that this repo does not cover.

## What was checked

Checked against public Qualtrics references on October 25, 2026. The [API getting-started guide](https://www.qualtrics.com/support/integrations/api-integration/overview/) supports the `X-API-TOKEN` header, brand-specific data-center host, and Access API permission guidance. The [user permissions reference](https://www.qualtrics.com/support/survey-platform/sp-administration/managing-users/user-permissions/) explains that permissions can be set at user, group, and division level, and that available features depend on the organization's license. Qualtrics' [common API questions](https://www.qualtrics.com/support/integrations/api-integration/common-api-questions-by-product/) describes response export as a create, poll, and download flow, which aligns with [`responses-and-exports.md`](./responses-and-exports.md). The [retake-link guide](https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/retake-survey-link/) clarifies that `Q_R_DEL=1` replaces the original response after the retake is submitted, rather than when the link is merely opened.

This review did **not** verify every endpoint, request schema, OAuth scope, permission key, Qualtrics product, license tier, or brand configuration described in the repository. The author could only inspect and exercise the endpoints and permissions available to their own Qualtrics account. Some field-level display-logic and workflow-email behavior described here is based on testing and was not established by the public reference pages reviewed. A behavior observed in one tenant may differ in another tenant or change as Qualtrics updates its platform.

Use the [official API documentation](https://api.qualtrics.com/) as the reference for endpoint behavior and schemas. Treat `permissions-and-scopes.md` as a troubleshooting starting point. Its endpoint-level permission and scope mappings are best-effort notes; some are based on observed responses, and some may be inferred. Where the evidence level is not stated for a row, assume it has **not** been independently verified across accounts.

## Instructions for AI coding agents

When using this repository as context:

1. Check the relevant endpoint in the official Qualtrics API reference before writing code. Confirm the method, path, request shape, response shape, and any endpoint-specific notes.
2. Treat permission and OAuth-scope suggestions here as hypotheses. Check the current Qualtrics admin permissions and OAuth client setup for the user's brand; ask an administrator for the smallest permission change that unblocks the specific operation.
3. Start with read-only calls such as `GET /API/v3/whoami` and a read of the target survey. Do not assume an example's IDs, data center, permissions, or product features apply to the user's account.
4. Before a write, check whether it changes a draft or a published survey. Use a test survey when possible, then verify the saved definition and test the published respondent experience.
5. Do not expose API tokens, live response data, respondent details, or real survey identifiers in prompts, logs, issues, or example files.

This repo's TypeScript files are examples and sketches, not a supported SDK. In particular, files labeled as stubs or intended interfaces should not be presented to an AI agent as implemented functions.
