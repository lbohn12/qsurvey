# Gotchas — the Qualtrics footgun atlas

A collection of Qualtrics API behaviors and troubleshooting notes. Entries describe a symptom, a likely cause, and a possible remediation; tenant-specific observations are labeled as such.

If you hit a bug that isn't in this doc: open an issue. New gotchas get added here before they get fixed in code.

## Why this file exists

These notes combine behavior observed during testing with the public references linked throughout the guide. They are not an exhaustive list of Qualtrics edge cases; verify behaviors that matter to your workflow in the official reference and your own account. The planned [UI-parity fixture harness](../spec.md#spec-4--ui-parity-fixture-harness-cross-cutting-applies-to-sdk) is not implemented yet.

## Where this guide fits with MCP

The planned SDK focuses on schema correctness and verification in addition to the operations exposed through the Qualtrics API and MCP tools. The behavioral notes below describe cases that may not be caught by a basic API wrapper; check the official reference and your tenant before treating a note as universal.

MCP can call documented API operations. These notes add implementation examples and cautionary patterns for AI-assisted scripting.

---

## `Q_R_DEL=1` replaces the original response when a retake is submitted

**Symptom:** A respondent follows a retake link containing `Q_R_DEL=1` and submits the retake. The original response is replaced by the retake response.

**Behavior:** Qualtrics documents `Q_R_DEL=1` as an option for retake links that replace an original response. The original response is deleted after the respondent submits the last page of the retake. Merely opening the link does not delete it. If the respondent starts but does not finish and incomplete responses are recorded, the incomplete retake may be stored separately. See [Qualtrics' retake-link instructions](https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/retake-survey-link/).

**Remediation:** Leave `Q_R_DEL=1` out of routine resume, reminder, and confirmation links. Include it only when intentionally offering a retake that should replace the prior response, and explain that behavior to the user. For duplicate-submission prevention, use survey settings and test the actual respondent flow; see `docs/survey-protection.md`.

**Planned SDK behavior:** `spec.md` REQ-2.39 — the `Q_R` URL helper does not append `Q_R_DEL=1` unless the caller explicitly opts in via the pointedly-named `deleteExistingResponse` flag.

**References:** [Qualtrics retake survey link](https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/retake-survey-link/).

---

## `InPageDisplayLogic` is a separate field from `DisplayLogic`

**Symptom:** Display logic is configured correctly in the Qualtrics editor. The "If Yes is Selected" condition shows on the child question. `inPage` is set to true. The API returns the rule on `GET /survey-definitions/{id}`. But when a respondent selects "Yes" on the parent, the follow-up question never renders.

**Cause:** Qualtrics stores display logic in two non-overlapping question fields. `DisplayLogic` fires only at page transitions (clicking Next). `InPageDisplayLogic` fires in real time as the respondent answers. The Qualtrics editor reads both fields and displays whichever is populated — so writing to `DisplayLogic` with `inPage: true` LOOKS correct but the runtime with In Page mode active only reads `InPageDisplayLogic`, which is empty. Silent, no error.

Additionally, the UI-produced `InPageDisplayLogic` schema requires extra fields that `DisplayLogic` payloads don't need:

- `QuestionIDFromLocator` — duplicate of `QuestionID`.
- `LeftOperand: "q://undefined/undefined"` — literal placeholder string; Qualtrics computes the real value at runtime.
- A Description built from CSS-classed spans: `<span class="ConjDesc">…</span> <span class="LeftOpDesc">…</span> <span class="OpDesc">…</span>`.

**Remediation:** Always write in-page display logic to `InPageDisplayLogic`, not `DisplayLogic`. Match the UI-saved JSON structure byte-for-byte including the placeholder fields. When clearing a rule, omit the key entirely — do not send `{"DisplayLogic": null}` (Qualtrics 400s on it, see the null-rejection entry below).

**Planned SDK behavior:** `spec.md` REQ-2.28 through REQ-2.31. Fixture harness (Spec 4) fails CI if the SDK's `buildInPageDisplayLogic` output diverges from the UI-saved snapshot.

**See also:** `docs/display-logic.md` for the full story with worked JSON examples.

**Evidence:** Observed during testing. The proposed fixture harness is not implemented yet.

---

## Piped `${q://QID.../QuestionTextEntry}` renders empty in Modern Workflow emails

**Symptom:** A Modern Workflow email is configured with a resume URL like `?Q_R=${q://QID103/QuestionTextEntry}` or a To address of `${q://QID103/QuestionTextEntry}`. The rendered URL is `?Q_R=` (empty). The To address is `""`. The email silently drops or 404s — no bounce, no error in Run History.

**Cause:** Piped question references don't resolve reliably in workflow email task contexts. The workflow runs "outside" the response the question belongs to.

**Remediation:** Never use `${q://…}` piped values in Modern Workflow emails for either To addresses or URL parameters. Instead, set the values you need as explicit embedded-data fields in a flow-level `EmbeddedData` node placed immediately after the capture block, then reference them as `${e://Field/…}` in the workflow. Example: after the block that captures the respondent's name/email, set `respondent_name`, `respondent_email`, and `response_id` as embedded data. The workflow email references them by embedded-data name.

**Planned SDK behavior:** `spec.md` REQ-2.34 — idempotent sync preserves manually-added `EmbeddedData` flow nodes so they aren't wiped on update.

**See also:** `docs/workflow-emails.md`; the workflow-email notes in this guide.

**Evidence:** Observed during testing; verify in your tenant.

---

## `${e://Field/ResponseID}` built-in also fails in workflow emails

**Symptom:** A workflow email URL is `?Q_R=${e://Field/ResponseID}`. Rendered URL is `?Q_R=` (empty). Every resume link 404s.

**Cause:** The all-caps built-in `${e://Field/ResponseID}` is one of several Qualtrics built-ins that do not resolve inside embedded-data-triggered Modern Workflow email tasks. It renders empty.

**Remediation:** Explicitly set a `response_id` embedded-data field (lowercase, user-defined) in the flow's `EmbeddedData` node, sourced from `${e://Field/ResponseID}` at that time. In workflow emails, reference the lowercase, explicitly-set version: `${e://Field/response_id}`.

**Evidence:** Observed during testing; verify in your tenant.

---

## Legacy Email Triggers (Actions) fail silently

**Symptom:** A post-submit confirmation email configured under Survey Tools → Actions/Triggers → Email Trigger never arrives. The Actions log may or may not show attempts. Recipient is a piped question value. Body is present.

**Cause:** Legacy Actions are deprecated. They break silently after Qualtrics platform updates. The common failure mode is that the piped To address renders empty (same pattern as the previous entry), the email goes nowhere, and no error propagates.

**Remediation:** Migrate to a Modern Workflow triggered on Response → Completed Response. Use `${e://Field/respondent_email}` as the To address. Disable or delete the legacy trigger after migration so you don't double-send once the legacy trigger starts working again.

**Evidence:** Observed during testing; verify in your tenant.

---

## Modern Workflow delay blocks cap at 7 days

**Symptom:** You try to build a "fire on the target date" per-response reminder but Qualtrics' Delay block won't accept any value longer than 7 days.

**Cause:** Qualtrics Modern Workflow Delay blocks have a hard 7-day maximum. This is not documented prominently.

**Remediation (in preference order):**

1. **Scheduled trigger workflow** — create a workflow with a Scheduled trigger (not Event-triggered). Lookup responses at the scheduled time, filter `Finished != True`, email each. Requires your Qualtrics tier to support Scheduled triggers; some licensing tiers don't.
2. **Chained Delay blocks** — use multiple 7-day delays in sequence. Works for a fixed offset from start (e.g., fires at start + 35 days) but NOT for a fixed calendar date across responses that started on different days.
3. **Manual batch send** — on the target date, export in-progress responses, mail-merge per-respondent resume links, and send outside Qualtrics.

**Evidence:** Observed during testing; verify in your tenant.

---

## Modern Workflow "Run Immediately" has no response context

**Symptom:** You click "Run Immediately" in the workflow editor to test a reminder email. Qualtrics prompts you to manually enter values for every embedded-data field the email references. You conclude the workflow is broken.

**Cause:** The test-run path does not simulate a real response flowing through the survey. There is no live response, so embedded-data fields are empty. The prompt for manual values is just Qualtrics letting you preview-render the email with placeholder data.

**Remediation:** Do not conclude from a test run that the workflow is broken. Validate by doing a real end-to-end submission — open the published link, advance past the capture block, wait for the email on real response data.

**Evidence:** Observed during testing; verify in your tenant.

---

## `ForceResponse` silently drops on some update calls

**Symptom:** You push an update to a question with `ForceResponse: "ON"` in the payload. The PUT returns 200. A later verify shows `ForceResponse` is absent from the question's `Validation.Settings` — not `OFF`, just missing. Re-running the same update fixes it.

**Cause:** Qualtrics' update endpoint occasionally drops fields during partial-update reconciliation. Intermittent, not reproducible on demand.

**Remediation:** Always run a verify pass after any update. If a required field is missing on any question, re-push. Do not assume a single successful PUT means the whole survey is correct.

**Planned SDK behavior:** `spec.md` REQ-2.35 — the `verify` method catches this and reports it as drift.

**Evidence:** Observed during testing; verify in your tenant.

---

## API-created questions are missing `ChoiceOrder`, `NextChoiceId`, `DataVisibility`, `SearchSource`

**Symptom:** Questions created via the API look identical to UI-created ones in the editor, but display logic referencing their choices behaves inconsistently at runtime. No direct error; subtle rendering bugs.

**Cause:** The Qualtrics UI automatically populates `ChoiceOrder`, `NextChoiceId`, `NextAnswerId`, `DataVisibility`, and `SearchSource` on every question it creates. API clients that hand-roll the minimal question payload omit these fields. They don't appear to be required for basic rendering, but they are load-bearing for some runtime behavior — including, suspected, display-logic choice resolution.

**Remediation:** Populate these fields on every question the SDK creates, matching what the UI writes by default. The fixture harness (Spec 4) encodes the correct defaults.

**Planned SDK behavior:** `spec.md` REQ-2.32 and REQ-2.33. Fixture harness per REQ-4.2.

**See also:** `docs/choice-fields.md` for the full field-by-field breakdown.

**Evidence:** Open question; requires further testing.

---

## `SurveyLinkCompletedMessage` via API rejects inline HTML

**Symptom:** Setting `UseCustomSurveyLinkCompletedMessage: "true"` and `SurveyLinkCompletedMessage: "<div>…</div>"` via `PUT /survey-definitions/{id}/options` returns 400 with `"Must validate one and only one schema (oneOf)"`.

**Cause:** The options API schema for this field accepts a message-library reference (e.g., `{"libraryId": "UR_…", "messageId": "MS_…"}`), not raw HTML. The UI hides this by creating a library message behind the scenes when you type into the editor.

**Remediation:** Set the message manually in the UI for now. SDK support for "create a message library entry and reference it" is REQ for a future iteration — see `docs/survey-protection.md` for the workaround.

**Planned SDK behavior:** `spec.md` REQ-2.37 — the SDK fails fast with a typed `ConfigurationError` when a schema tries to set inline HTML for this field.

**Evidence:** Observed during testing; verify in your tenant.

---

## `BallotBoxStuffingPrevention` can help prevent same-browser resubmissions

**Symptom:** You enable a flow-level branch guard (`submission_status == "submitted"` → terminal block) to block post-submit re-entry. It doesn't fire. Submitted respondents click their resume link and land on a fresh 0% survey.

**Cause:** In some configurations, Save-and-Continue does not load a completed response into the flow when its `Q_R` link is opened. Qualtrics may start a new response instead. That response has no `submission_status` embedded data, so a branch guard may not fire. Test with the target survey's settings.

**Remediation:** Enable `BallotBoxStuffingPrevention: "true"` in `SurveyOptions` (Survey Options → Security → Prevent Multiple Submissions). This is cookie-based — same-browser detection. Covers the primary case (respondent re-opens the email in the same browser). Does not cover cross-device or incognito, which are much narrower threat surfaces. The flow-level branch guard remains as a secondary defense for any other path that does load the completed response.

**Planned SDK behavior:** `spec.md` REQ-2.36 — the SDK sets both options by default when the schema's `preventResubmission` flag is true.

**See also:** `docs/survey-protection.md` for the lever-vs-threat-model matrix.

**Evidence:** Observed during testing; verify in your tenant.

---

## Qualtrics 400s on `{"DisplayLogic": null}` when clearing a rule

**Symptom:** Trying to clear a stale display-logic rule by sending `{"DisplayLogic": null}` in a question PUT returns 400 with `"Must validate one and only one schema (oneOf)"`.

**Cause:** Qualtrics' schema validates `DisplayLogic` as either absent or an object — not null. `oneOf` rejects null.

**Remediation:** Omit the `DisplayLogic` key from the PUT payload entirely. Qualtrics will preserve whatever was there; to actually clear, do it via the UI, or issue a targeted PUT with an empty object `{}` and test — behavior depends on endpoint.

**Planned SDK behavior:** `spec.md` REQ-2.31.

**Evidence:** Endpoint behavior should be tested before relying on this workaround.

---

## The editor reads `DisplayLogic` and `InPageDisplayLogic` interchangeably; the runtime does not

**Symptom:** You eyeball the display-logic panel in the Qualtrics editor. It shows the correct condition. The In Page checkbox is ticked. You're confident the logic is configured. You publish. Respondents still don't see the follow-up.

**Cause:** The editor is forgiving — it displays whichever of `DisplayLogic` or `InPageDisplayLogic` is populated. The respondent-facing runtime is strict — for In Page mode it reads only `InPageDisplayLogic`. Visual editor inspection is insufficient to confirm the rule will fire at runtime.

**Remediation:** Verify via API, not visual inspection. Fetch the question JSON, confirm the rule is in `InPageDisplayLogic` and `DisplayLogic` is null/absent. Run `qsurvey verify` (REQ-2.35) on any survey that was edited in the UI to catch field-placement drift.

**See also:** `docs/display-logic.md`; fixture harness in `tests/fixtures/ui-snapshots/`.

**Evidence:** Observed during testing; verify in your tenant.

---

## Publishing is not automatic on every change

**Symptom:** You update a survey via the API. The editor reflects the change. You test via the published link and see the old version.

**Cause:** `/survey-definitions/{id}` reads and writes the **draft**. Respondents see the **published** version, which is a separate snapshot taken at publish time. Preview links also render the draft, so preview testing can disagree with the published runtime.

**Remediation:** Always `publish()` after any mutation intended for respondents. Test via the published anonymous link, not the preview link, when validating runtime behavior.

**See also:** `docs/survey-platform.md` (which flags this already).

**Evidence:** Observed during testing; verify in your tenant.

---

## See also

- [`display-logic.md`](./display-logic.md) — details on the DisplayLogic / InPageDisplayLogic behavior
- [`workflow-emails.md`](./workflow-emails.md) — workflow email patterns and traps
- [`survey-protection.md`](./survey-protection.md) — resubmission-prevention matrix
- [`idempotent-sync.md`](./idempotent-sync.md) — how `qsurvey sync` preserves UI-managed nodes
- [`choice-fields.md`](./choice-fields.md) — the scaffolding fields the UI adds that the API must match
- [`mcp-dev-setup.md`](./mcp-dev-setup.md) — MCP server install for hitting live APIs during dev
- this guide — an incomplete collection of observed Qualtrics behaviors
