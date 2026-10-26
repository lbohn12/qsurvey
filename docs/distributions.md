# Distributions

Distributions are the mechanism for getting respondents to a survey. Qualtrics recognises several kinds:

- **Anonymous link** — a single shareable URL. No per-respondent tracking. Zero setup. This is what `qsurvey from-pdf` emits in v0.
- **Mailing-list distribution** — send a per-respondent link via Qualtrics-hosted email to a directory mailing list. Each recipient gets a unique token so you can track who responded.
- **Individual link distribution** — generate unique links without sending email. Useful when you want to paste per-person links into another system.
- **Reminder / thank-you** — send a follow-up email to non-respondents or respondents of an existing distribution.

**Prerequisites:** Access API for all. Anonymous-link retrieval requires only survey ownership. Everything else requires **Distribute Surveys** and, for mailing-list-backed flows, directory permissions. See [`permissions-and-scopes.md`](./permissions-and-scopes.md#distributions).

## Anonymous link

The simplest and the one `qsurvey from-pdf` emits. For any active survey:

```
https://{datacenter}.qualtrics.com/jfe/form/{surveyId}
```

Two ways to retrieve it:

1. **Construct client-side** from the data center + survey ID. Works before the survey is activated, but the URL 404s until activation.
2. **Read it from the survey summary:**

   ```http
   GET /API/v3/surveys/{surveyId}
   X-API-TOKEN: {token}
   ```

   Inspect `result.distributionLinks.anonymous` if present. On some brands this field is only populated after at least one distribution has been created — fall back to construction.

## Mailing-list distribution

Prerequisite: you have a directory and a mailing list with contacts in it. See [`directory.md`](./directory.md) for creating them.

```http
POST /API/v3/distributions
Content-Type: application/json
X-API-TOKEN: {token}

{
  "surveyLink": { "surveyId": "SV_abc", "expirationDate": "2026-12-31T00:00:00Z", "type": "Individual" },
  "header": {
    "fromEmail": "noreply@example.org",
    "replyToEmail": "contact@example.org",
    "fromName": "Example Survey",
    "subject": "Action required: intake survey"
  },
  "recipients": { "mailingListId": "CG_abc", "contactId": null, "libraryId": "UR_xyz" },
  "message": { "libraryId": "UR_xyz", "messageId": "MS_abc" },
  "sendDate": "2026-04-20T09:00:00-05:00"
}
```

Response includes the `distributionId`. The mail is queued, not sent synchronously — delivery happens on `sendDate`.

## Individual links (without email)

Generate unique survey links for a mailing list and return them in the response, without Qualtrics sending email itself:

```http
POST /API/v3/distributions
Content-Type: application/json
X-API-TOKEN: {token}

{
  "surveyLink": { "surveyId": "SV_abc", "expirationDate": "2026-12-31T00:00:00Z", "type": "Individual" },
  "recipients": { "mailingListId": "CG_abc", "libraryId": "UR_xyz" },
  "sendDate": null
}
```

Then fetch the generated links:

```http
GET /API/v3/distributions/{distributionId}/links?surveyId={SV_abc}
```

## Reminders and thank-yous

```http
POST /API/v3/distributions/{distributionId}/reminders
Content-Type: application/json
X-API-TOKEN: {token}

{
  "header": { "fromEmail": "...", "subject": "Reminder: survey closes Friday" },
  "message": { "libraryId": "UR_xyz", "messageId": "MS_reminder" },
  "sendDate": "2026-04-25T09:00:00-05:00"
}
```

`POST /distributions/{id}/thankyous` has the same shape but goes to people who *did* respond.

## List and inspect distributions

```http
GET /API/v3/distributions?surveyId={SV_abc}
```

Returns a list of distributions on a survey with their statuses (`Sent`, `Scheduled`, `InProgress`, `Failed`).

```http
GET /API/v3/distributions/{distributionId}
```

Returns the individual distribution including a `stats` block: sent count, opened count, clicked count, response count. Use this for dashboards.

## Common pitfalls

- **Library IDs.** `libraryId` in the request body is the Qualtrics library the message template lives in. For personal tokens it is typically `UR_{userId}`. For brand templates it is `GR_{groupId}`. The admin UI labels these differently, which is confusing; use [`directory.md`](./directory.md) as a reference.
- **Mailing-list vs. sample.** "Sample" distributions (sending to a subset of a list) require Qualtrics Research Core and are not covered by the v0 SDK.
- **Send date in the past.** Qualtrics accepts it silently and sends immediately. If you want to send now, set `sendDate` to `new Date().toISOString()` and move on.

## Resume links and the `Q_R_DEL` trap

Personalized resume links use the `Q_R` query parameter: `https://{datacenter}.qualtrics.com/jfe/form/{surveyId}?Q_R={responseId}`. A returning respondent who clicks this link lands on their in-progress response at the point they left off (assuming Save-and-Continue is on).

Leave `&Q_R_DEL=1` out of routine resume links. Qualtrics documents it for retake links that replace an existing response after the retake is submitted; opening the link alone does not delete the response. See [Qualtrics' retake-link instructions](https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/retake-survey-link/) and [`gotchas.md`](./gotchas.md#q_r_del1-replaces-the-original-response-when-a-retake-is-submitted).

Per [`spec.md`](../spec.md) REQ-2.39, the proposed `buildResumeUrl()` helper would omit `Q_R_DEL=1` by default and require an explicit `deleteExistingResponse` option for retake-and-replace behavior.

For duplicate-response concerns across devices, use `BallotBoxStuffingPrevention` (see [`survey-protection.md`](./survey-protection.md)) rather than URL parameters.

## See also

- [`permissions-and-scopes.md`](./permissions-and-scopes.md#distributions)
- [`directory.md`](./directory.md) — mailing lists and contacts are directory objects.
- [`survey-platform.md`](./survey-platform.md) — the survey must be activated before distributions can send.
- [`survey-protection.md`](./survey-protection.md) — cookie- and flag-based levers for preventing resubmission.
- [`workflow-emails.md`](./workflow-emails.md) — using `${e://Field/response_id}` in workflow email URLs.
- [`gotchas.md`](./gotchas.md) — the full catalogue of Qualtrics footguns.
