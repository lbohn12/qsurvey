# qsurvey — EARS Specifications

**Project:** `qsurvey` — a Qualtrics toolkit for research staff working with AI-assisted development

**Author:** Lincoln Bohn
**Status:** Draft v0.1
**Last updated:** April 2026

---

## About this document

This is a set of requirements specifications written in **EARS** (Easy Approach to Requirements Syntax) for three related but independently shippable products:

1. **`qsurvey from-pdf`** — the weekend v0 CLI command. One job: turn a PDF into a live Qualtrics survey.
2. **`qsurvey` SDK** — the typed client library underneath the CLI. Usable standalone for anyone who wants a sane Qualtrics API.
3. **Branded portal layer** — the hosted v2 that wraps `qsurvey`-managed surveys in a researcher-controlled public portal.

EARS uses a small set of sentence patterns to make requirements unambiguous and testable:

- **Ubiquitous** — "The system shall…" (always true)
- **Event-driven** — "When \<trigger\>, the system shall…"
- **State-driven** — "While \<state\>, the system shall…"
- **Unwanted behavior** — "If \<condition\>, then the system shall…"
- **Optional feature** — "Where \<feature included\>, the system shall…"

Each spec below is structured so that every requirement is one of those patterns. If you find yourself writing a requirement that doesn't fit one of the five, it's probably not a requirement yet — it's a design note. Move it to the design notes section at the bottom of each spec.

---

## Spec 1 — `qsurvey from-pdf` (v0)

### Purpose

Generate a working Qualtrics survey from a source PDF in a single command. This is the thing a researcher runs when their funder hands them a 20-page RFA PDF and says "make this an application portal by next month." The command should do in one line what currently takes days of hand-translation and API wrangling.

### Users

**Primary:** Research staff at universities and research institutes who have an active Qualtrics enterprise license, moderate technical skills (comfortable with the terminal, can follow a README, have used Claude Code or similar), and a PDF they need to turn into a survey. This is explicitly not the non-technical PI and not the seasoned API engineer. It's the person in between — the one whose tooling options are currently either "do it by hand" or "spend three weeks learning the Qualtrics API."

**Secondary:** AI-assisted development agents (Claude Code, Cursor, etc.) operating on behalf of the primary user. The CLI's error messages, flags, and output formats should be legible to an LLM that is helping the user drive it.

### Goals

- **Collapse time from PDF to working survey** from days to minutes.
- **Eliminate the most common failure modes** that cost the author a week on the CSSA RFA portal build: opaque API errors, question ID/name confusion, data center routing, brittle hand-written seed scripts.
- **Be the kind of tool a grad student can install at 1am** with `npm install -g qsurvey` (or equivalent) and use immediately with an existing enterprise Qualtrics token.

### Non-goals (v0)

- Replacing Qualtrics. Not this version, probably not ever.
- Supporting Google Forms, REDCap, SurveyMonkey, or any other backend. v0 is Qualtrics only.
- Hosting anything. v0 is a local CLI.
- Branded portals, custom domains, response forwarding, email notifications — all v2.
- A web UI. v0 is CLI only.
- Complex question types beyond what appears in a typical RFA or screening form (multiple choice, text entry, matrix, file upload, basic branching).

### Requirements

#### Core behavior

- **REQ-1.1** The CLI shall accept a path to a PDF file as its primary positional argument.
- **REQ-1.2** When given a valid readable PDF, the CLI shall extract questions, answer choices, section headers, and branching logic into an intermediate structured representation.
- **REQ-1.3** When the intermediate representation is generated, the CLI shall create a corresponding survey via the Qualtrics API.
- **REQ-1.4** When survey creation succeeds, the CLI shall print the survey ID, the Qualtrics edit URL, and the anonymous preview link to stdout.
- **REQ-1.5** The CLI shall write the intermediate structured representation to a sidecar JSON file adjacent to the source PDF, so that the output is inspectable and re-runnable.

#### Authentication and configuration

- **REQ-1.6** The CLI shall read the Qualtrics API token from the `QUALTRICS_API_TOKEN` environment variable.
- **REQ-1.7** The CLI shall read the Qualtrics data center identifier from the `QUALTRICS_DATA_CENTER` environment variable.
- **REQ-1.8** While the `QUALTRICS_API_TOKEN` environment variable is missing, the CLI shall fail before making any network calls and shall print a message explaining where in the Qualtrics UI to obtain a token and how to export it.
- **REQ-1.9** While the `QUALTRICS_DATA_CENTER` environment variable is missing, the CLI shall fail before making any network calls and shall print a message explaining how to find the correct data center for the user's account.
- **REQ-1.10** Where a `.qsurveyrc` or equivalent config file exists in the working directory or the user's home directory, the CLI shall read token and data center values from it as a fallback to environment variables.

#### Flags

- **REQ-1.11** Where the `--dry-run` flag is provided, the CLI shall produce the intermediate structured representation and print it to stdout without making any calls to the Qualtrics API.
- **REQ-1.12** Where the `--output <path>` flag is provided, the CLI shall write the intermediate representation to the specified path instead of the default sidecar location.
- **REQ-1.13** Where the `--data-center <id>` flag is provided, the CLI shall route API requests to the specified data center, overriding the environment variable.
- **REQ-1.14** Where the `--name <survey name>` flag is provided, the CLI shall use the specified name when creating the survey instead of deriving one from the PDF filename.
- **REQ-1.15** Where the `--verbose` flag is provided, the CLI shall log all outgoing Qualtrics API requests and their responses to stderr, redacting the API token.

#### Error handling

- **REQ-1.16** If the PDF file cannot be read or is not a valid PDF, then the CLI shall fail with an error message naming the file and exit with status code 2.
- **REQ-1.17** If PDF parsing produces zero extractable questions, then the CLI shall fail with a message suggesting the user inspect the file or run with `--verbose`, and exit with status code 3.
- **REQ-1.18** If PDF parsing produces an ambiguous or low-confidence structure, then the CLI shall write a diagnostic report to the working directory listing the ambiguous sections and exit with status code 4.
- **REQ-1.19** If the Qualtrics API returns a 4xx response, then the CLI shall print the full response body, exit with status code 5, and not retry.
- **REQ-1.20** If the Qualtrics API returns a 5xx response or a network error, then the CLI shall retry up to three times with exponential backoff before exiting with status code 6.
- **REQ-1.21** If the user's Qualtrics account does not have API access enabled, then the CLI shall detect this condition from the API response and print a message explaining that enterprise API access is required.

#### LLM-legibility

- **REQ-1.22** The CLI shall emit all error messages in a structured format that includes a machine-readable error code, a human-readable message, and a suggested remediation step.
- **REQ-1.23** Where the `--json` flag is provided, the CLI shall emit all output (success and error) as newline-delimited JSON suitable for parsing by an automation agent.

#### Post-creation verification and safe defaults (added April 2026)

- **REQ-1.24** After creating a survey via `from-pdf`, the CLI shall invoke the SDK's `verify` method (REQ-2.35) and print any structural drift before exiting.
- **REQ-1.25** The CLI shall enable `BallotBoxStuffingPrevention` (REQ-2.36) by default on every survey it creates, unless the user passes `--allow-multiple-submissions`.
- **REQ-1.26** The CLI shall never emit a resume link or URL template containing `Q_R_DEL=1`. This applies to stdout output, sidecar JSON output, and any sample email body the CLI generates.
- **REQ-1.27** Where the `--verify` flag is provided against an existing survey ID, the CLI shall skip creation and print only the structural diff produced by REQ-2.35.

### Acceptance criteria for shipping v0

The v0 is shippable when all of the following are true:

1. The author can run `qsurvey from-pdf ./cssa-rfa.pdf` against the actual CSSA RFA PDF from the CSSA Cohort 2.0 grant and get a working Qualtrics survey that matches the one currently in production, modulo branding.
2. The README contains a side-by-side comparison of the raw Qualtrics API approach (with Python, as originally built) and the `qsurvey from-pdf` approach, both producing the same survey.
3. A researcher who has never seen the tool before can go from `npm install` to a working survey in under ten minutes, using only the README.
4. All error conditions listed above produce helpful messages, not stack traces.

### Design notes (not requirements)

- The PDF parsing step will almost certainly call an LLM. Claude is the reasonable default. The LLM call should be swappable so the tool is not locked to one provider.
- The intermediate representation format should be stable and documented. It is the contract between the parser and the survey-creation step, and it is also the thing users will version-control.
- The author should resist adding question types beyond what appears in the CSSA RFA until a real user asks for them.

---

## Spec 2 — `qsurvey` SDK (core primitives)

### Purpose

A typed client library for the Qualtrics API that is sane to use, pleasant to read, and legible to AI-assisted developers. It is the layer underneath the CLI, and it is also independently valuable to anyone building custom tooling against Qualtrics.

### Users

**Primary:** Research software developers (staff like the author, plus the small number of engineers embedded in research centers) who need to script against Qualtrics and are currently writing brittle `requests`-based Python or fighting the official API docs.

**Secondary:** AI coding agents generating code against Qualtrics on behalf of research staff. The SDK's types, method names, and documentation should be optimized for LLM code generation — predictable naming, full type coverage, docstrings with examples.

**Tertiary:** The `qsurvey` CLI itself, which is the first consumer of the SDK.

### Goals

- **Make the common case one line of code.** Creating a survey, adding a question, reading responses — each should be a single method call with a typed return value.
- **Make errors legible.** When the Qualtrics API fails, the SDK should surface *why* in a way that doesn't require knowing Qualtrics internals.
- **Be the library a frontier model reaches for first** when asked to "write a Python script that talks to Qualtrics." Predictable enough that Claude or GPT writes working code on the first try.

### Non-goals

- Replacing the full Qualtrics API surface. Cover the 80% of operations that research staff actually use; ignore the rest until asked.
- Supporting every Qualtrics product line (CX, EX, etc.). Focus on core Survey Platform.
- Providing a GUI, a hosted service, or any network components beyond the HTTP client.
- Language parity. v0 is one language only. (JavaScript/TypeScript is the default assumption given the author's Claude Code workflow and the CLI target; Python is the likely second.)

### Requirements

#### Core API surface

- **REQ-2.1** The SDK shall expose typed methods for creating, reading, updating, and deleting surveys.
- **REQ-2.2** The SDK shall expose typed methods for creating, reading, updating, and deleting questions within a survey.
- **REQ-2.3** The SDK shall expose typed methods for creating, reading, updating, and deleting blocks within a survey.
- **REQ-2.4** The SDK shall expose typed methods for reading responses from a survey, with support for pagination and filtering by date range.
- **REQ-2.5** The SDK shall expose a typed method for activating and deactivating a survey.
- **REQ-2.6** The SDK shall expose a typed method for retrieving the anonymous distribution link for a survey.

#### Declarative schema

- **REQ-2.7** The SDK shall represent a survey as a declarative schema object containing the survey's metadata, blocks, questions, and flow.
- **REQ-2.8** The SDK shall provide a method to serialize a schema object to JSON.
- **REQ-2.9** The SDK shall provide a method to deserialize a schema object from JSON.
- **REQ-2.10** When called with a schema object and no survey ID, the SDK shall create a new survey matching the schema and return the new survey's ID.
- **REQ-2.11** When called with a schema object and an existing survey ID, the SDK shall perform an idempotent sync, updating only the fields that differ between the schema and the live survey.
- **REQ-2.12** When performing an idempotent sync, the SDK shall return a diff describing which fields were changed.

#### Authentication

- **REQ-2.13** The SDK shall accept an API token and a data center identifier at client construction time.
- **REQ-2.14** If a method requiring authentication is called before the client is constructed with credentials, then the SDK shall throw a typed `AuthenticationError` with remediation guidance.
- **REQ-2.15** The SDK shall never log the API token, including when debug logging is enabled.

#### Error handling

- **REQ-2.16** When the Qualtrics API returns a non-2xx response, the SDK shall throw a typed exception whose class corresponds to the error category (authentication, rate limit, not found, validation, server error).
- **REQ-2.17** Every thrown exception shall include the full response body, the HTTP status code, the request URL, and the request method.
- **REQ-2.18** If a rate limit response is received, then the SDK shall either retry with backoff (when automatic retry is enabled) or throw a `RateLimitError` containing the retry-after value.
- **REQ-2.19** Where automatic retry is enabled via client configuration, the SDK shall retry idempotent requests up to a configurable number of times with exponential backoff on 5xx and rate-limit responses.

#### Observability

- **REQ-2.20** Where debug logging is enabled via client configuration, the SDK shall log every outgoing request and incoming response.
- **REQ-2.21** The SDK shall redact the API token and any other secrets from all log output.
- **REQ-2.22** Where a custom logger is provided via client configuration, the SDK shall route all log output through that logger.

#### Data center routing

- **REQ-2.23** The SDK shall construct all request URLs using the configured data center identifier.
- **REQ-2.24** If the data center identifier is missing or malformed, then the SDK shall throw a typed `ConfigurationError` before making any network calls.

#### Type coverage

- **REQ-2.25** The SDK shall provide full type definitions for every public method parameter and return value.
- **REQ-2.26** The SDK shall provide type definitions for every supported question type.
- **REQ-2.27** Where the Qualtrics API returns a field the SDK does not model, the SDK shall preserve that field on the returned object under a typed `extensions` property, rather than dropping it.

#### Display-logic correctness (added April 2026 after CSSA RFA 2 launch-day debugging)

These REQs exist because today's other Qualtrics client libraries get display logic wrong in a way that passes every lint, every type check, and every visual editor inspection, yet silently fails at runtime for respondents. See [`docs/display-logic.md`](./docs/display-logic.md) and the `CSSA RFA 2/LESSONS.md` entry #13 for the post-mortem.

- **REQ-2.28** The SDK shall write in-page display logic to the question's `InPageDisplayLogic` field, not `DisplayLogic`.
- **REQ-2.29** When building an `InPageDisplayLogic` payload, the SDK shall include the `QuestionIDFromLocator` and `LeftOperand` placeholder fields that the Qualtrics UI emits, matching the UI-saved structure byte-for-byte.
- **REQ-2.30** When building an `InPageDisplayLogic` payload, the SDK shall construct the `Description` field using the CSS-classed span structure the Qualtrics UI emits (`<span class="ConjDesc">…</span> <span class="LeftOpDesc">…</span> <span class="OpDesc">…</span>`).
- **REQ-2.31** When clearing display logic, the SDK shall omit the `DisplayLogic` and `InPageDisplayLogic` keys from the update payload rather than sending them as `null` — Qualtrics' options and question PUT endpoints reject `null` for these fields with a 400.

#### Choice-field scaffolding parity with UI-created questions

- **REQ-2.32** When creating or updating a multiple-choice question, the SDK shall include `ChoiceOrder` derived from the ordered choice keys, even when the caller did not supply it explicitly.
- **REQ-2.33** When creating or updating a question, the SDK shall populate the default fields the Qualtrics UI writes on question creation (`NextChoiceId`, `NextAnswerId`, `DataVisibility`, `SearchSource`), so that API-created questions are structurally indistinguishable from UI-created ones. See [`docs/choice-fields.md`](./docs/choice-fields.md).

#### Idempotent sync — preserve UI-managed nodes

- **REQ-2.34** When idempotently syncing a survey, the SDK shall preserve any flow nodes, embedded-data setters, and survey-option fields the caller's schema does not explicitly override — specifically, it shall not wipe `EmbeddedData` nodes that set piped-field values used by Modern Workflows.
- **REQ-2.35** The SDK shall expose a `verify` method that fetches the live survey definition and returns a structural diff against a schema object, flagging any drift in questions, blocks, flow, and survey options.

#### Survey protection helpers

- **REQ-2.36** Where the caller enables "prevent resubmission" via schema, the SDK shall set `BallotBoxStuffingPrevention: "true"` and `BallotBoxStuffingPreventionBehavior: "DefaultMessage"` in `SurveyOptions`. See [`docs/survey-protection.md`](./docs/survey-protection.md).
- **REQ-2.37** If a schema specifies a custom `SurveyLinkCompletedMessage` as inline HTML, then the SDK shall fail fast with a typed `ConfigurationError` explaining that the Qualtrics Options API requires a message-library reference, and shall point at the UI-only workaround until `qsurvey libraries` ships.
- **REQ-2.38** The SDK shall expose a typed helper for building post-submit guard flows: a Branch flow element whose condition evaluates an embedded-data flag (e.g., `submission_status == "submitted"`) and routes completed responses to a caller-specified terminal block.

#### Safe URLs

- **REQ-2.39** The SDK shall expose a typed helper for building a Qualtrics `Q_R` resume URL. The helper shall NOT append `Q_R_DEL=1` by default, and the parameter to enable it shall be named `deleteExistingResponse` with inline documentation stating "destructive to completed responses; never use in URLs that may reach an applicant after submission." See [`docs/gotchas.md`](./docs/gotchas.md#q_r_del-wipes-completed-responses).

### Transport: MCP-first, HTTP-optional (added April 2026 after overlap audit)

After auditing overlap against the Qualtrics MCP surface (both Qualtrics' auto-generated per-API MCP servers and the community `yrvelez/qualtrics-mcp-server`), the SDK's primary transport is MCP. Hand-rolled HTTP is a fallback, not the default.

Rationale: ~50–60% of REQ-2.1 through REQ-2.6 duplicate capabilities an MCP server already exposes. The non-overlapping portion — declarative schemas (REQ-2.7 through REQ-2.12), idempotent sync with UI-node preservation (REQ-2.34), the verify method (REQ-2.35), the display-logic/choice-field correctness REQs (REQ-2.28 through REQ-2.33), the survey-protection helpers (REQ-2.36 through REQ-2.38), the Q_R resume-URL helper (REQ-2.39), and type coverage across question types (REQ-2.25 through REQ-2.27) — is the actual moat and is not provided by any MCP server.

- **REQ-2.40** The SDK shall expose a transport abstraction with at least two implementations: `mcp` (routed through an MCP server configured at client construction) and `http` (hand-rolled HTTPS against the Qualtrics REST API).
- **REQ-2.41** The default transport shall be `mcp` when an MCP server is configured, and `http` otherwise.
- **REQ-2.42** Where the `mcp` transport is selected, the SDK shall implement REQ-2.1 through REQ-2.6 (basic CRUD) by invoking MCP tools rather than issuing HTTPS requests directly.
- **REQ-2.43** The SDK's typed error hierarchy (REQ-2.16) shall apply regardless of transport. When the MCP transport surfaces a tool error, the SDK shall map it to the appropriate typed exception before throwing.

### Acceptance criteria for shipping the SDK

1. The CLI from Spec 1 is implemented entirely in terms of SDK calls, with no direct HTTP code.
2. A researcher with no prior Qualtrics API experience can, with Claude Code's help, write a working script in under fifteen minutes that creates a survey with five questions and retrieves its anonymous link.
3. All type definitions are complete enough that a TypeScript compiler passes in strict mode against the public API.
4. The README contains at least five runnable examples covering the common tasks.

### Design notes

- Naming discipline is load-bearing. "Survey," "block," "question," "response," "distribution" — use Qualtrics' own nouns, not invented synonyms. LLMs and users both pattern-match on them.
- Schema objects should be plain data, not classes with behavior. This keeps them serializable, diffable, and easy to generate from other tools (including the PDF parser).
- The SDK should not attempt to hide the concept of data centers. Qualtrics makes users deal with them, and pretending they don't exist will leak in confusing ways. Make them prominent, well-documented, and hard to get wrong.

---

## Spec 3 — Branded portal layer (v2, hosted)

### Purpose

Let researchers wrap a `qsurvey`-managed Qualtrics survey in a branded public-facing portal without fighting Qualtrics' native theming limits, without requiring a new vendor agreement at their institution, and without hand-rolling a workaround involving personal websites and anonymous links (as the author did for the CSSA RFA portal).

This is the hosted, paid layer. It is explicitly a v2 concept and should not be built until the v0 CLI and SDK have demonstrated traction through their open-source distribution.

### Users

**Primary:** Research centers and institutes that use the `qsurvey` CLI or SDK and need a public-facing intake or application portal with institutional branding.

**Secondary:** Individual PIs with dissemination budgets in their grants who need a branded project website fronting a Qualtrics form.

### Goals

- **Eliminate the workaround tax.** No more "embed the anonymous link behind a page on my personal site" nonsense.
- **Bypass institutional procurement.** The researcher's institution already has a Qualtrics agreement; the portal service uses that agreement transparently. The researcher pays for the portal layer personally or via grant funds, not via a new enterprise software procurement.
- **Provide the features Qualtrics won't.** Custom domains, proper branding, configurable closed-state pages, reliable notifications, retry on submission failure.

### Non-goals (v2)

- Replacing Qualtrics as a survey engine. The underlying survey still lives in Qualtrics and is managed via `qsurvey`.
- Being a general-purpose form builder. The schema comes from `qsurvey`; the portal is the delivery layer.
- Supporting arbitrary backends. v2 is Qualtrics-backed only. Support for other backends (Google Forms, REDCap) is a later concern.

### Requirements

#### Publication

- **REQ-3.1** The service shall allow a researcher to publish any `qsurvey`-managed survey as a branded hosted portal.
- **REQ-3.2** When a researcher publishes a portal, the service shall provision a hosted URL on a service-owned subdomain.
- **REQ-3.3** Where the researcher configures a custom domain, the service shall serve the portal at that domain with valid TLS.
- **REQ-3.4** When a portal is published, the service shall fetch the current survey structure from Qualtrics via the `qsurvey` SDK and cache it for rendering.
- **REQ-3.5** Where the underlying survey schema changes, the service shall re-fetch and update the cached structure within a configurable refresh interval.

#### Submission handling

- **REQ-3.6** When a respondent submits a form via the portal, the service shall forward the response to the underlying Qualtrics survey via the `qsurvey` SDK.
- **REQ-3.7** When a submission is successfully forwarded, the service shall display a configurable confirmation page to the respondent.
- **REQ-3.8** If the underlying Qualtrics API is unreachable at submission time, then the service shall queue the response locally and retry delivery with exponential backoff.
- **REQ-3.9** If a queued submission cannot be delivered after the configured maximum retry window, then the service shall notify the portal owner via the configured notification channel and preserve the raw submission for manual recovery.
- **REQ-3.10** The service shall never drop a submission silently.

#### State management

- **REQ-3.11** While the underlying Qualtrics survey is closed or inactive, the service shall display a configurable closed-state page instead of the form.
- **REQ-3.12** Where the portal owner configures an open window (start and end dates), the service shall display the form only during that window and shall display configurable pre-open and post-close pages outside it.
- **REQ-3.13** While the portal is in a scheduled closed state, the service shall continue to serve the closed-state page without depending on live Qualtrics availability.

#### Branding

- **REQ-3.14** Where the researcher provides a logo, the service shall display it in the portal header.
- **REQ-3.15** Where the researcher provides color tokens, the service shall apply them to the portal theme.
- **REQ-3.16** Where the researcher provides typography settings, the service shall apply them to the portal.
- **REQ-3.17** Where the researcher provides custom CSS, the service shall apply it last in the cascade, allowing overrides of the default theme.
- **REQ-3.18** The service shall provide a live preview of branding changes before publication.

#### Notifications

- **REQ-3.19** Where the researcher enables email notifications, the service shall send a configurable message to specified recipients on each submission.
- **REQ-3.20** Where the researcher enables digest notifications, the service shall send a scheduled summary of submissions rather than per-submission emails.
- **REQ-3.21** If a notification delivery fails, then the service shall retry with backoff and log the failure for the portal owner.

#### Access control

- **REQ-3.22** Each portal shall be owned by exactly one researcher account.
- **REQ-3.23** Where the owner invites collaborators, the service shall allow collaborators to view submissions and edit branding but not to delete the portal or transfer ownership.
- **REQ-3.24** The service shall log all administrative actions (publication, unpublication, branding changes, collaborator changes) for audit purposes.

#### Compliance hooks

- **REQ-3.25** Where the portal is configured as handling sensitive data, the service shall display a configurable consent notice before the form and shall record consent alongside each submission.
- **REQ-3.26** The service shall not store respondent PII beyond the duration required to forward it to Qualtrics, except where the portal owner has explicitly enabled local response retention.

### Acceptance criteria for shipping v2

1. The author can re-host the CSSA RFA portal entirely on the service, with full branding, a custom domain, and the existing Qualtrics survey underneath, with zero manual workarounds.
2. A researcher at another institution can publish a branded portal on top of their own Qualtrics survey without involving their institution's IT procurement.
3. The service survives a simulated Qualtrics outage without losing any submissions.
4. All branding changes are visible in a live preview before publication.

### Design notes

- The business model for v2 is the Vercel/Supabase playbook: the CLI and SDK are free and open source, the hosted portal is a paid tier. The paid tier justifies itself by removing the workaround tax, not by locking users in.
- Pricing should be legible to researchers and should accommodate grant-based payment. One-time payments tied to a project period are likely more natural than monthly subscriptions for this audience.
- The service should never require researchers to give up their existing Qualtrics license. It sits on top of what they already have.
- Do not build this until the v0 CLI has demonstrated unambiguous pull — stars, forks, real users opening issues about real use cases. The worst failure mode for this project is building v2 speculatively before v0 has proven the audience exists.

---

## Cross-cutting concerns

### Versioning

All three products shall follow semantic versioning. The SDK's public API is the primary contract and breaking changes to it shall bump the major version. The CLI's flag surface and output format are also part of the public contract.

### Documentation

Every public method in the SDK shall have a docstring with at least one runnable example. The CLI shall ship with a README containing the side-by-side "before/after" comparison against the raw Qualtrics API. The portal service shall ship with a getting-started guide aimed at researchers who have never hosted a web service.

### Testing

Every SDK method shall have unit tests covering success, the most common failure mode, and authentication failure. The CLI shall have integration tests that run against a Qualtrics sandbox account. The portal service shall have end-to-end tests covering publication, submission, and outage recovery.

### Relationship between the three specs

Spec 1 depends on Spec 2. Spec 3 depends on Spec 2. Spec 2 stands alone. The correct build order is: ship the smallest useful subset of Spec 2 needed to implement Spec 1; ship Spec 1; gather signal; only then decide whether to expand Spec 2 and pursue Spec 3.

### What is explicitly not in any of these specs

- The AI-native survey builder that replaces Qualtrics wholesale. Different product, different conversation.
- IWDWYT. Different product, different population, different conversation.
- Plant Powered Pixels as a services business. Different model entirely — not a product spec.
- Political polling, market research, or any non-research adjacent market. Valid future expansion directions, but not v0, v1, or v2 scope.

---

## Spec 4 — UI-parity fixture harness (cross-cutting, applies to SDK)

### Purpose

Prevent the class of silent-failure bug that cost the author a day during CSSA RFA 2 launch: the SDK's generated payloads passed every check yet diverged from Qualtrics UI–saved payloads in runtime-load-bearing ways (field name, missing scaffolding fields, missing placeholder strings). This spec makes that divergence a test failure with a named, linked remediation.

### Users

**Primary:** SDK contributors, both human and LLM-assisted. When a contributor adds or modifies a question-type factory or a display-logic helper, the fixture harness fails CI unless the produced payload matches a known-good UI-saved reference, forcing the contributor to notice fields the Qualtrics UI silently adds that they may have omitted.

**Secondary:** Downstream SDK consumers with unusual custom workflows. They can add their own fixtures to catch regressions on their specific edge cases.

### Goals

- **Catch field-name bugs like `DisplayLogic` vs `InPageDisplayLogic` at unit-test time**, not in production.
- **Keep the SDK's output indistinguishable from the Qualtrics UI's**, so manual UI edits to SDK-managed surveys round-trip cleanly.
- **Document which fields are "runtime-critical" vs "cosmetic"** so diffs produce actionable errors, not noise.

### Non-goals

- Integration tests against a live Qualtrics account. Those are separate; this spec is purely about fixture-based unit parity.
- Fuzzing the Qualtrics API for undocumented behavior. The fixtures are canonical examples, not exhaustive.

### Requirements

- **REQ-4.1** The project shall ship a fixture set of UI-saved Qualtrics question JSON snapshots under `tests/fixtures/ui-snapshots/`. The initial set shall cover at least: MC/SAVR, MC/MACOL, MC/MAVR, TE/SL, TE/ML, TE/ESTB, Matrix/Likert, FileUpload, DB/TB, and a question with `InPageDisplayLogic`.
- **REQ-4.2** For each supported question type, the SDK shall include a unit test that diffs the SDK's `buildQuestionPayload` output against the corresponding UI-saved fixture and fails on divergence in any field marked runtime-critical.
- **REQ-4.3** The project shall document the fixture regeneration procedure in `tests/fixtures/README.md`: open the Qualtrics UI, create a canonical question, fetch the live JSON via `GET /survey-definitions/{id}`, extract the `Questions[QID]` object, and commit it with a dated filename (e.g., `mc-savr.2026-04.json`).
- **REQ-4.4** When a fixture test fails, the error message shall name the diverging field, show the UI-saved value, show the SDK-produced value, and link to the entry in `docs/gotchas.md` that explains why the field matters.
- **REQ-4.5** The fixtures shall be re-validated against a live Qualtrics account at least quarterly, and after any Qualtrics platform release note touching survey structure. The validation procedure shall live alongside the fixtures in `tests/fixtures/README.md`.
- **REQ-4.6** Fields on UI-saved fixtures shall be classified as "runtime-critical" (diff must match; failure blocks CI) or "cosmetic" (diff may differ; informational only). The classification list shall live in `tests/fixtures/field-classification.json` and shall be reviewed against CSSA `LESSONS.md` whenever a new gotcha is documented.

### Acceptance criteria for shipping the fixture harness

1. The 10 baseline question types in REQ-4.1 are present with UI-saved snapshots.
2. `npm test` (or `pnpm test`) runs the UI-parity suite and passes against the stub SDK.
3. A deliberate regression — e.g., renaming `InPageDisplayLogic` to `DisplayLogic` in the SDK builder, or removing `ChoiceOrder` — fails the suite with a message naming the exact field and linking to `docs/gotchas.md`.
4. Regenerating a fixture is a single documented command (or a three-step documented procedure if no single command is feasible).

### Design notes

- Fixtures are human-readable JSON, committed alongside their regeneration date in the filename. Binary fixtures or snapshots-as-strings are forbidden.
- The field-classification file is the source of truth for "does this diff matter?" and is itself reviewed as part of every new gotcha entry. A gotcha that reveals a new runtime-critical field is not closed until the classification reflects it.
- The harness has deliberately no dependency on a live Qualtrics account at test time, so CI runs offline.

---

*End of document.*
