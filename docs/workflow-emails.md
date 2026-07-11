# Workflow emails — patterns that actually work

Everything this doc says is specific to Qualtrics **Modern Workflows**. Legacy Actions / Email Triggers are deprecated and should be migrated away from; see [`gotchas.md`](./gotchas.md#legacy-email-triggers-actions-fail-silently).

**Prerequisites:** Manage Workflows Across Projects. See [`workflows.md`](./workflows.md) for the base permission story and [`permissions-and-scopes.md`](./permissions-and-scopes.md#workflows).

## Concepts

A workflow email has four parts:

- **Trigger** — event that fires the workflow. Two common shapes: "embedded-data set" (fires as soon as a named embedded-data field is populated) and "Response Completed" (fires on submit).
- **Condition** — optional boolean gate. Typical: `Response.Finished != True` to suppress reminder emails once the applicant has submitted.
- **Delay** — optional timer. Max 7 days per block. See [`gotchas.md`](./gotchas.md#modern-workflow-delay-blocks-cap-at-7-days).
- **Email task** — the actual send. To, From, Reply-To, Subject, Body, optional attachments.

## The one rule that prevents 90% of bugs

**Reference embedded-data fields, not piped question values, in every workflow email.**

The Qualtrics editor will let you use `${q://QID356/QuestionTextEntry}` in a To address or a URL parameter. It may even work in preview. It will intermittently render empty at runtime and silently drop the email. Don't do it. Ever.

Instead: set an explicit embedded-data field in the survey flow immediately after the capture block, and reference it in the email.

## The canonical pattern

### 1. Add an EmbeddedData flow node after the capture block

In the survey flow, immediately after the block where the applicant enters their name and email, insert an `EmbeddedData` flow element that captures those values into named embedded-data fields:

```json
{
  "Type": "EmbeddedData",
  "FlowID": "FL_16",
  "EmbeddedData": [
    {
      "Description": "respondent_name",
      "Type": "Recipient",
      "Field": "respondent_name",
      "VariableType": "String",
      "DataVisibility": {"Private": false, "Hidden": false},
      "AnalyzeText": false,
      "Value": "${q://QID355/QuestionTextEntry}"
    },
    {
      "Description": "respondent_email",
      "Type": "Recipient",
      "Field": "respondent_email",
      "VariableType": "String",
      "DataVisibility": {"Private": false, "Hidden": false},
      "AnalyzeText": false,
      "Value": "${q://QID356/QuestionTextEntry}"
    },
    {
      "Description": "response_id",
      "Type": "Recipient",
      "Field": "response_id",
      "VariableType": "String",
      "DataVisibility": {"Private": false, "Hidden": false},
      "AnalyzeText": false,
      "Value": "${e://Field/ResponseID}"
    }
  ]
}
```

Note: piping `${q://…}` **inside the flow node** to set the embedded-data value works reliably. The trap is piping it **directly in the workflow email task**. The flow node serves as the indirection layer.

Similarly for `response_id` — the built-in `${e://Field/ResponseID}` works as a source value in the flow node but not directly in workflow email tasks. Set it via the flow node, reference the lowercase version in the email.

### 2. Trigger the workflow on the embedded-data-set event

Configure the workflow trigger as "Response Recorded" scoped to the survey, OR use the "Embedded data set" event on `respondent_email` (fires as soon as the capture block advances). Either way, by the time the email task runs, `${e://Field/respondent_email}` is populated.

### 3. Reference embedded-data fields in the email

**Good:**

```
To: ${e://Field/respondent_email}
Subject: a production cohort — Your Application Link

Hi ${e://Field/respondent_name},

Use the link below to return to your application:
https://acme.az1.qualtrics.com/jfe/form/SV_xyz?Q_R=${e://Field/response_id}
```

**Bad:**

```
To: ${q://QID356/QuestionTextEntry}                    # fails silently
?Q_R=${e://Field/ResponseID}                            # fails silently
?Q_R=${e://Field/response_id}&Q_R_DEL=1                 # wipes submitted responses
```

### 4. Hyperlink the URL in the editor

Paste the URL into the email body, immediately select it, and click the link icon to wrap it in `<a href>`. If the URL is not hyperlinked, Qualtrics' email editor may soft-wrap long URLs with real whitespace inside the URL, which breaks the link in the recipient's mail client. After hyperlinking, preview the email and confirm clicking the link preserves the full URL.

## Suppression conditions

Reminder workflows (welcome, 3-day check-in, 1-week nudge, etc.) need a condition that prevents the email from firing for applicants who have already submitted. Two equivalent approaches:

- **Built-in condition:** `Response.Finished != True`. Simple, uses Qualtrics' built-in response property. Recommended unless you need a custom flag.
- **Embedded-data condition:** `${e://Field/submission_status} != submitted`, paired with a flow-level `EmbeddedData` setter that sets `submission_status = "submitted"` immediately before the terminal `EndSurvey`. Useful when you want custom submission-state semantics (e.g., a pre-submission review step that should count as "submitted" for reminder-suppression purposes).

Per [`spec.md`](../spec.md) REQ-2.38, the `qsurvey` SDK ships a helper for the submission-status pattern.

## The 7-day delay cap and the May-24 problem

Modern Workflow Delay blocks cap at 7 days. This is a hard limit. Common patterns the cap breaks:

- **"Fire on a fixed calendar date regardless of when the applicant started."** E.g., "5 days before the May 29 deadline, remind everyone in-progress." Applicants who started 30 days before the deadline can't be reminded via event-triggered workflows.

Workarounds, in preference order:

1. **Scheduled trigger** — a separate workflow with trigger type Scheduled (not Event). At the scheduled time, the workflow enumerates responses matching a filter and sends per-response. Requires Qualtrics tier that supports Scheduled triggers.
2. **Chained 7-day delays** — works for "fire at start + N days" where N ≤ 7×D for D delay blocks. Does NOT work for a fixed calendar date since N varies per applicant.
3. **Manual batch send** — on the target date, export in-progress responses via Data & Analysis or the API, mail-merge per-applicant resume links, send outside Qualtrics. the origin project used this for a production cohort; see the internal workflow-email notes for the operational playbook.

## The `Run Immediately` trap

Clicking "Run Immediately" in the workflow editor does NOT test your email against a real response — there's no response context. Qualtrics prompts you for test values for every embedded-data field the email references. The preview is useful for rendering, not validating.

**To actually test:** start a real response through the published link, advance past the capture block, wait for the email. See [`gotchas.md`](./gotchas.md#modern-workflow-run-immediately-has-no-response-context).

## URL safety

**Never append `&Q_R_DEL=1` to any applicant-facing URL.** See [`gotchas.md`](./gotchas.md#q_r_del1-wipes-completed-responses) for the full story. The qsurvey SDK's `buildResumeUrl()` helper (REQ-2.39) never adds it by default.

## Testing before go-live

For each reminder workflow:

1. Start a real test response through the **published** link (not preview).
2. Advance past the capture block to trigger the embedded-data-set event.
3. Wait for the email. Check spam/junk — Qualtrics' `noreply@qemailserver.com` has weak deliverability and is routinely spam-filtered by institutional inboxes.
4. Click the link from a different browser to validate cross-device resume.
5. After submission, click the link again and confirm you hit the "already submitted" protection (see [`survey-protection.md`](./survey-protection.md)), NOT a fresh 0% survey.
6. Check Data & Analysis — the submitted response should still be there.

For reminder workflows with a delay > 0: temporarily shorten the delay to ~2 min in the UI, test, revert. **Do not forget to revert.**

## See also

- [`workflows.md`](./workflows.md) — workflow basics and API surface
- [`gotchas.md`](./gotchas.md) — the full catalogue of workflow-adjacent traps
- [`survey-protection.md`](./survey-protection.md) — the protection side of the picture
- the internal workflow-email notes — worked example covering welcome, reminder, confirmation, and manual batch patterns
