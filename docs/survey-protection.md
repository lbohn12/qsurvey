# Survey protection — preventing resubmission and post-submit re-entry

The goal: once an applicant submits, they cannot silently overwrite their submission by clicking a resume link a second time. Qualtrics provides several overlapping levers that each cover different threat scenarios. None of them alone covers everything. This doc maps which lever beats which scenario so you can stack them deliberately.

**Prerequisites:** Edit Survey permission for the options changes. See [`permissions-and-scopes.md`](./permissions-and-scopes.md).

## The threat model

"Submitted applicant clicks their resume link again" sounds like one scenario but is actually several:

| Scenario | Description |
| --- | --- |
| **Same browser, same window** | Applicant submits, then clicks the welcome email link in the same browser tab where they submitted. |
| **Same browser, fresh window** | Applicant opens a new incognito-style window and clicks the link. Cookies from submission may or may not carry depending on browser settings. |
| **Different browser, same device** | Applicant forwards the link to a different browser or opens a different profile on the same device. |
| **Different device** | Applicant forwards the link to their phone or a colleague. |
| **Direct URL re-entry** | Applicant has bookmarked the in-progress URL and loads it after submitting. |

Each is a weaker attack surface than the previous, but each is different, and different levers cover different subsets.

## The levers

### 1. `Q_R_DEL=1` — NOT a protection lever; a data-destruction bug

Mentioning this only to be clear: `&Q_R_DEL=1` on a resume URL **deletes** the referenced response on click. It was intended to prevent duplicate responses from cross-device resumes, but it unconditionally wipes completed responses too. **Never use it** in any URL that could reach a submitted applicant. See [`gotchas.md`](./gotchas.md#q_r_del1-wipes-completed-responses).

### 2. Survey-flow branch guard — flag-based

Pattern: set an embedded-data flag (`submission_status = "submitted"`) at the end of the flow, and add a Branch at the top of the flow that routes `submission_status == "submitted"` responses to a terminal "already submitted" block.

**Covers:** Any scenario where Qualtrics actually loads the completed response into the flow. Direct URL re-entry (`?Q_R=<completed_id>` without `Q_R_DEL=1`) sometimes does this, sometimes doesn't — it depends on Save-and-Continue behavior.

**Does not cover:** The common case. When Save-and-Continue is enabled and `Q_R_DEL=1` is absent, Qualtrics often starts a fresh response for `?Q_R=<completed_id>`. The fresh response has no `submission_status`, so the branch guard never fires. This is the primary failure mode observed on the origin project — see the internal post-mortem.

**SDK support:** `spec.md` REQ-2.38 — the SDK exposes `buildAlreadySubmittedGuard()` for this pattern.

**Verdict:** Secondary defense only. Use in combination with the next lever, not instead of it.

### 3. `BallotBoxStuffingPrevention` (Prevent Multiple Submissions) — cookie-based

Survey option. Under the hood: Qualtrics sets a cookie on submission; on subsequent visits from the same browser, the cookie triggers a "thank you, already submitted" page instead of the survey.

**Covers:**

| Scenario | Covered? |
| --- | --- |
| Same browser, same window | Yes |
| Same browser, fresh window | Yes (cookie persists across windows) |
| Different browser, same device | No (cookies don't carry across browsers) |
| Different device | No |
| Incognito / private browsing | No (private mode doesn't share cookies with normal windows) |

**How to enable:**

- **Via Qualtrics UI:** Survey Options → Security → Prevent Multiple Submissions → On. Set the "When a multi-submission is detected" option to "Show default message" (or a custom one if you create a library message).
- **Via API:** set `BallotBoxStuffingPrevention: "true"` and `BallotBoxStuffingPreventionBehavior: "DefaultMessage"` in `SurveyOptions`. Requires the follow-up PUT to `/survey-definitions/{id}/options`.
- **Via qsurvey SDK:** `spec.md` REQ-2.36 — set `preventResubmission: true` on the schema; the SDK sets both option fields.

**Verdict:** The primary lever. Covers the common case (same applicant re-clicks their own email from the same browser). Combine with the branch guard (lever 2) for belt-and-suspenders.

### 4. `SurveyLinkCompletedMessage` — message shown when a specific response ID is completed

Survey option. When an applicant clicks `?Q_R=<completed_id>` (with or without `Q_R_DEL`), this message can intercept BEFORE any flow runs.

**Covers:** Any scenario where the URL contains `Q_R=<completed_id>` and that response is in Finished state. Cross-device, cross-browser, fresh window — all work, because the check is against the response, not the browser cookie.

**Does not cover:** Direct-URL entry without `Q_R=…` (i.e., someone visiting the base `/jfe/form/…` URL). For that, use `BallotBoxStuffingPrevention`.

**Known API limitation:** `SurveyLinkCompletedMessage` in the options API expects a message-library reference, not inline HTML. Setting it to `"<div>…</div>"` returns 400 `"Must validate one and only one schema (oneOf)"`. The workaround is to set it via the UI (Survey Options → Responses) or create a library message via `/libraries/…/messages` and reference it by ID. The SDK fails fast on inline HTML per `spec.md` REQ-2.37.

**Verdict:** Excellent complement to `BallotBoxStuffingPrevention` for covering cross-device and cross-browser cases. Combine with the other two levers where possible.

### 5. Survey expiration / close date

Survey option. Lets you set an end date after which the survey rejects submissions.

**Covers:** Time-bounded "application deadline" semantics. Not specifically a resubmission defense, but applicants who try to re-submit after the deadline hit the close message regardless of lever 3.

**Verdict:** Independent of resubmission prevention; set it because your grant deadline exists, not as a protection lever.

## Recommended stack

For most application-portal surveys (the origin project-style):

```ts
// Pseudo-code — real SDK surface TBD
schema.surveyOptions = {
  // Lever 3 — primary defense, cookie-based, same-browser
  preventResubmission: true,

  // Lever 4 — complements lever 3 for cross-device cases
  // Must be set via UI until library-message helper ships; see REQ-2.37
  // surveyLinkCompletedMessage: { libraryId: "UR_…", messageId: "MS_…" },

  // Lever 5 — deadline semantics
  expirationDate: "2026-05-29T17:00:00-07:00",
};

// Lever 2 — belt-and-suspenders, flag-based branch guard
schema.flow.unshift(buildAlreadySubmittedGuard({
  embeddedDataField: "submission_status",
  expectedValue: "submitted",
  terminalBlockDescription: "Already Submitted",
}));
schema.flow.splice(-1, 0, buildEmbeddedDataSetter({
  submission_status: "submitted",
}));
```

## The `BallotBoxStuffingPrevention` default-message flow

When `BallotBoxStuffingPreventionBehavior: "DefaultMessage"` is set and a returning browser is detected, Qualtrics displays its built-in "thank you; your survey response has been recorded" page. It's plain but functional. To customize:

1. In the Qualtrics UI: Survey Options → Security → Prevent Multiple Submissions → "When a multi-submission is detected" → Custom Message, then select or create a library message.
2. Via API: set `BallotBoxStuffingPreventionBehavior: "CustomMessage"` and `BallotBoxStuffingPreventionMessage` / `BallotBoxStuffingPreventionMessageLibrary` to a message-library reference (same shape issue as `SurveyLinkCompletedMessage`).

## What about HIPAA, PII, single-response-per-person at institutional scale?

Those are different conversations. The levers here address "soft-stop this applicant from accidentally overwriting their submission." For enterprise-scale identity verification, use Qualtrics' SSO or Authenticator flow elements. Those require Qualtrics consultation and are out of scope for this SDK.

## See also

- [`gotchas.md`](./gotchas.md) — the detailed failure modes these levers protect against
- [`idempotent-sync.md`](./idempotent-sync.md) — the verify pattern that confirms these options stay set after updates
- [Qualtrics Security Options reference](https://www.qualtrics.com/support/survey-platform/survey-module/survey-options/survey-protection/)
- the internal post-mortem — the original debug session that mapped this space
