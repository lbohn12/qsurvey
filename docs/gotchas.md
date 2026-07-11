# Gotchas — the Qualtrics footgun atlas

A catalogue of silent-failure patterns the Qualtrics API rewards you for ignoring. Every entry has a symptom, a cause, a remediation, and references to the relevant `spec.md` REQ number and the internal post-mortem entry that originated it.

If you hit a bug that isn't in this doc: open an issue. New gotchas get added here before they get fixed in code.

## Why this file exists

Every other open-source Qualtrics package — `Jaseibert/QualtricsAPI`, `Baguage/pyqualtrics`, `matomatical/qualtrics`, `cwade/py_qualtrics_api`, `pytrics` — optimizes for reading response data. None of them documents the failure modes below. The `qsurvey` moat is: we catalogue the footguns, the SDK enforces safe defaults against them, and the [UI-parity fixture harness](../spec.md#spec-4--ui-parity-fixture-harness-cross-cutting-applies-to-sdk) fails CI when the SDK's output drifts from Qualtrics' own UI-saved structures.

## Why qsurvey exists on top of MCP

The SDK re-scoped in April 2026 (see `spec.md` Transport: MCP-first, HTTP-optional) after an honest audit of overlap with Qualtrics' MCP servers and the community `yrvelez/qualtrics-mcp-server`. About half the SDK's original surface (survey CRUD, question CRUD, block CRUD, response export) duplicates tools MCP already exposes. The half this document justifies — correctness traps that MCP tool-wrappers can't catch because they're schema traps, not API traps — is what the SDK is for.

In short: use MCP for imperative "do a thing." Use `qsurvey` for "get the schema right and verify it later."

---

## `Q_R_DEL=1` wipes completed responses

**Symptom:** An applicant clicks a personalized resume link after submitting. Instead of landing on an "already submitted" page, they get a fresh 0% survey. Their submitted response disappears from the dataset entirely.

**Cause:** The resume URL contains `&Q_R_DEL=1`. Qualtrics interprets this as "if a response exists for this `Q_R` ID, delete it and start a new one." The semantic is unconditional — it applies to completed responses, not just abandoned-duplicate ones.

**Remediation:** Never append `Q_R_DEL=1` to URLs that may reach a user after submission. Strip it from all reminder, confirmation, and batch-send templates. Replace with plain `?Q_R=<response_id>`. For cross-device duplicate prevention, use `BallotBoxStuffingPrevention` via survey options (see `docs/survey-protection.md`), not URL parameters.

**SDK enforcement:** `spec.md` REQ-2.39 — the `Q_R` URL helper does not append `Q_R_DEL=1` unless the caller explicitly opts in via the pointedly-named `deleteExistingResponse` flag.

**References:** the internal post-mortem.

---

## `InPageDisplayLogic` is a separate field from `DisplayLogic`

**Symptom:** Display logic is configured correctly in the Qualtrics editor. The "If Yes is Selected" condition shows on the child question. `inPage` is set to true. The API returns the rule on `GET /survey-definitions/{id}`. But when a respondent selects "Yes" on the parent, the follow-up question never renders.

**Cause:** Qualtrics stores display logic in two non-overlapping question fields. `DisplayLogic` fires only at page transitions (clicking Next). `InPageDisplayLogic` fires in real time as the respondent answers. The Qualtrics editor reads both fields and displays whichever is populated — so writing to `DisplayLogic` with `inPage: true` LOOKS correct but the runtime with In Page mode active only reads `InPageDisplayLogic`, which is empty. Silent, no error.

Additionally, the UI-produced `InPageDisplayLogic` schema requires extra fields that `DisplayLogic` payloads don't need:

- `QuestionIDFromLocator` — duplicate of `QuestionID`.
- `LeftOperand: "q://undefined/undefined"` — literal placeholder string; Qualtrics computes the real value at runtime.
- A Description built from CSS-classed spans: `<span class="ConjDesc">…</span> <span class="LeftOpDesc">…</span> <span class="OpDesc">…</span>`.

**Remediation:** Always write in-page display logic to `InPageDisplayLogic`, not `DisplayLogic`. Match the UI-saved JSON structure byte-for-byte including the placeholder fields. When clearing a rule, omit the key entirely — do not send `{"DisplayLogic": null}` (Qualtrics 400s on it, see the null-rejection entry below).

**SDK enforcement:** `spec.md` REQ-2.28 through REQ-2.31. Fixture harness (Spec 4) fails CI if the SDK's `buildInPageDisplayLogic` output diverges from the UI-saved snapshot.

**See also:** `docs/display-logic.md` for the full story with worked JSON examples.

**References:** the internal post-mortem — this is the post-mortem bug that motivates `qsurvey`'s fixture harness.

---

## Piped `${q://QID.../QuestionTextEntry}` renders empty in Modern Workflow emails

**Symptom:** A Modern Workflow email is configured with a resume URL like `?Q_R=${q://QID356/QuestionTextEntry}` or a To address of `${q://QID356/QuestionTextEntry}`. The rendered URL is `?Q_R=` (empty). The To address is `""`. The email silently drops or 404s — no bounce, no error in Run History.

**Cause:** Piped question references don't resolve reliably in workflow email task contexts. The workflow runs "outside" the response the question belongs to.

**Remediation:** Never use `${q://…}` piped values in Modern Workflow emails for either To addresses or URL parameters. Instead, set the values you need as explicit embedded-data fields in a flow-level `EmbeddedData` node placed immediately after the capture block, then reference them as `${e://Field/…}` in the workflow. Example: after the block that captures the applicant's name/email, set `respondent_name`, `respondent_email`, and `response_id` as embedded data. The workflow email references them by embedded-data name.

**SDK enforcement:** `spec.md` REQ-2.34 — idempotent sync preserves manually-added `EmbeddedData` flow nodes so they aren't wiped on update.

**See also:** `docs/workflow-emails.md`; the internal workflow-email notes.

**References:** the internal post-mortem.

---

## `${e://Field/ResponseID}` built-in also fails in workflow emails

**Symptom:** A workflow email URL is `?Q_R=${e://Field/ResponseID}`. Rendered URL is `?Q_R=` (empty). Every resume link 404s.

**Cause:** The all-caps built-in `${e://Field/ResponseID}` is one of several Qualtrics built-ins that do not resolve inside embedded-data-triggered Modern Workflow email tasks. It renders empty.

**Remediation:** Explicitly set a `response_id` embedded-data field (lowercase, user-defined) in the flow's `EmbeddedData` node, sourced from `${e://Field/ResponseID}` at that time. In workflow emails, reference the lowercase, explicitly-set version: `${e://Field/response_id}`.

**References:** the internal post-mortem.

---

## Legacy Email Triggers (Actions) fail silently

**Symptom:** A post-submit confirmation email configured under Survey Tools → Actions/Triggers → Email Trigger never arrives. The Actions log may or may not show attempts. Recipient is a piped question value. Body is present.

**Cause:** Legacy Actions are deprecated. They break silently after Qualtrics platform updates. The common failure mode is that the piped To address renders empty (same pattern as the previous entry), the email goes nowhere, and no error propagates.

**Remediation:** Migrate to a Modern Workflow triggered on Response → Completed Response. Use `${e://Field/respondent_email}` as the To address. Disable or delete the legacy trigger after migration so you don't double-send once the legacy trigger starts working again.

**References:** the internal post-mortem.

---

## Modern Workflow delay blocks cap at 7 days

**Symptom:** You try to build a "fire on May 24" per-response reminder but Qualtrics' Delay block won't accept any value longer than 7 days.

**Cause:** Qualtrics Modern Workflow Delay blocks have a hard 7-day maximum. This is not documented prominently.

**Remediation (in preference order):**

1. **Scheduled trigger workflow** — create a workflow with a Scheduled trigger (not Event-triggered). Lookup responses at the scheduled time, filter `Finished != True`, email each. Requires your Qualtrics tier to support Scheduled triggers; some licensing tiers don't.
2. **Chained Delay blocks** — use multiple 7-day delays in sequence. Works for a fixed offset from start (e.g., fires at start + 35 days) but NOT for a fixed calendar date across responses that started on different days.
3. **Manual batch send** — on the target date, export in-progress responses, mail-merge per-applicant resume links, send outside Qualtrics. the origin project used this for a production cohort.

**References:** the internal post-mortem.

---

## Modern Workflow "Run Immediately" has no response context

**Symptom:** You click "Run Immediately" in the workflow editor to test a reminder email. Qualtrics prompts you to manually enter values for every embedded-data field the email references. You conclude the workflow is broken.

**Cause:** The test-run path does not simulate a real response flowing through the survey. There is no live response, so embedded-data fields are empty. The prompt for manual values is just Qualtrics letting you preview-render the email with placeholder data.

**Remediation:** Do not conclude from a test run that the workflow is broken. Validate by doing a real end-to-end submission — open the published link, advance past the capture block, wait for the email on real response data.

**References:** the internal post-mortem.

---

## `ForceResponse` silently drops on some update calls

**Symptom:** You push an update to a question with `ForceResponse: "ON"` in the payload. The PUT returns 200. A later verify shows `ForceResponse` is absent from the question's `Validation.Settings` — not `OFF`, just missing. Re-running the same update fixes it.

**Cause:** Qualtrics' update endpoint occasionally drops fields during partial-update reconciliation. Intermittent, not reproducible on demand.

**Remediation:** Always run a verify pass after any update. If a required field is missing on any question, re-push. Do not assume a single successful PUT means the whole survey is correct.

**SDK enforcement:** `spec.md` REQ-2.35 — the `verify` method catches this and reports it as drift.

**References:** the internal post-mortem.

---

## API-created questions are missing `ChoiceOrder`, `NextChoiceId`, `DataVisibility`, `SearchSource`

**Symptom:** Questions created via the API look identical to UI-created ones in the editor, but display logic referencing their choices behaves inconsistently at runtime. No direct error; subtle rendering bugs.

**Cause:** The Qualtrics UI automatically populates `ChoiceOrder`, `NextChoiceId`, `NextAnswerId`, `DataVisibility`, and `SearchSource` on every question it creates. API clients that hand-roll the minimal question payload omit these fields. They don't appear to be required for basic rendering, but they are load-bearing for some runtime behavior — including, suspected, display-logic choice resolution.

**Remediation:** Populate these fields on every question the SDK creates, matching what the UI writes by default. The fixture harness (Spec 4) encodes the correct defaults.

**SDK enforcement:** `spec.md` REQ-2.32 and REQ-2.33. Fixture harness per REQ-4.2.

**See also:** `docs/choice-fields.md` for the full field-by-field breakdown.

**References:** the internal post-mortem (open question under "still didn't render even after field-name fix").

---

## `SurveyLinkCompletedMessage` via API rejects inline HTML

**Symptom:** Setting `UseCustomSurveyLinkCompletedMessage: "true"` and `SurveyLinkCompletedMessage: "<div>…</div>"` via `PUT /survey-definitions/{id}/options` returns 400 with `"Must validate one and only one schema (oneOf)"`.

**Cause:** The options API schema for this field accepts a message-library reference (e.g., `{"libraryId": "UR_…", "messageId": "MS_…"}`), not raw HTML. The UI hides this by creating a library message behind the scenes when you type into the editor.

**Remediation:** Set the message manually in the UI for now. SDK support for "create a message library entry and reference it" is REQ for a future iteration — see `docs/survey-protection.md` for the workaround.

**SDK enforcement:** `spec.md` REQ-2.37 — the SDK fails fast with a typed `ConfigurationError` when a schema tries to set inline HTML for this field.

**References:** the internal post-mortem.

---

## `BallotBoxStuffingPrevention` is the actual "prevent resubmission" lever

**Symptom:** You enable a flow-level branch guard (`submission_status == "submitted"` → terminal block) to block post-submit re-entry. It doesn't fire. Submitted applicants click their resume link and land on a fresh 0% survey.

**Cause:** When Save-and-Continue is enabled and an applicant clicks `?Q_R=<completed_id>` without `Q_R_DEL=1`, Qualtrics does NOT load the completed response into the flow. It starts a brand-new response. The fresh response has no `submission_status` embedded data, so the branch guard evaluates false and the applicant proceeds through the survey.

**Remediation:** Enable `BallotBoxStuffingPrevention: "true"` in `SurveyOptions` (Survey Options → Security → Prevent Multiple Submissions). This is cookie-based — same-browser detection. Covers the primary case (applicant re-opens the email in the same browser). Does not cover cross-device or incognito, which are much narrower threat surfaces. The flow-level branch guard remains as a secondary defense for any other path that does load the completed response.

**SDK enforcement:** `spec.md` REQ-2.36 — the SDK sets both options by default when the schema's `preventResubmission` flag is true.

**See also:** `docs/survey-protection.md` for the lever-vs-threat-model matrix.

**References:** the internal post-mortem.

---

## Qualtrics 400s on `{"DisplayLogic": null}` when clearing a rule

**Symptom:** Trying to clear a stale display-logic rule by sending `{"DisplayLogic": null}` in a question PUT returns 400 with `"Must validate one and only one schema (oneOf)"`.

**Cause:** Qualtrics' schema validates `DisplayLogic` as either absent or an object — not null. `oneOf` rejects null.

**Remediation:** Omit the `DisplayLogic` key from the PUT payload entirely. Qualtrics will preserve whatever was there; to actually clear, do it via the UI, or issue a targeted PUT with an empty object `{}` and test — behavior depends on endpoint.

**SDK enforcement:** `spec.md` REQ-2.31.

**References:** the internal post-mortem addendum.

---

## The editor reads `DisplayLogic` and `InPageDisplayLogic` interchangeably; the runtime does not

**Symptom:** You eyeball the display-logic panel in the Qualtrics editor. It shows the correct condition. The In Page checkbox is ticked. You're confident the logic is configured. You publish. Respondents still don't see the follow-up.

**Cause:** The editor is forgiving — it displays whichever of `DisplayLogic` or `InPageDisplayLogic` is populated. The respondent-facing runtime is strict — for In Page mode it reads only `InPageDisplayLogic`. Visual editor inspection is insufficient to confirm the rule will fire at runtime.

**Remediation:** Verify via API, not visual inspection. Fetch the question JSON, confirm the rule is in `InPageDisplayLogic` and `DisplayLogic` is null/absent. Run `qsurvey verify` (REQ-2.35) on any survey that was edited in the UI to catch field-placement drift.

**See also:** `docs/display-logic.md`; fixture harness in `tests/fixtures/ui-snapshots/`.

**References:** the internal post-mortem.

---

## Publishing is not automatic on every change

**Symptom:** You update a survey via the API. The editor reflects the change. You test via the published link and see the old version.

**Cause:** `/survey-definitions/{id}` reads and writes the **draft**. Respondents see the **published** version, which is a separate snapshot taken at publish time. Preview links also render the draft, so preview testing can disagree with the published runtime.

**Remediation:** Always `publish()` after any mutation intended for respondents. Test via the published anonymous link, not the preview link, when validating runtime behavior.

**See also:** `docs/survey-platform.md` (which flags this already).

**References:** the internal post-mortem.

---

## See also

- [`display-logic.md`](./display-logic.md) — full post-mortem on the DisplayLogic / InPageDisplayLogic bug
- [`workflow-emails.md`](./workflow-emails.md) — workflow email patterns and traps
- [`survey-protection.md`](./survey-protection.md) — resubmission-prevention matrix
- [`idempotent-sync.md`](./idempotent-sync.md) — how `qsurvey sync` preserves UI-managed nodes
- [`choice-fields.md`](./choice-fields.md) — the scaffolding fields the UI adds that the API must match
- [`mcp-dev-setup.md`](./mcp-dev-setup.md) — MCP server install for hitting live APIs during dev
- the internal post-mortem — the canonical record of every Qualtrics bug that shaped this SDK
