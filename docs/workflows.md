# Workflows

> **The permission the author's original token did not have.** If you see `insufficient permissions` or a 403 on any `/workflows/*` endpoint, your personal API token is missing the **Manage Workflows Across Projects** user permission. Copy [`request-for-permissions.md`](./request-for-permissions.md), fill it in, and send it to your brand admin. Nothing else in this doc matters until that is fixed.

Workflows are Qualtrics' automation layer. They replace the older "Actions" concept. A workflow is a triggered sequence: something happens (an **event**), and then one or more **tasks** run in response. The research-common uses are:

- "When a response is submitted to survey X, post to Slack."
- "When a new contact is added to mailing list Y, send them a confirmation email."
- "Every Monday at 9am, export last week's responses to S3."
- "When a response score crosses a threshold, create a ticket in Jira."

**Prerequisites:** Access API + Manage Workflows Across Projects. OAuth: `manage:all` is the reliable scope; fine-grained `read:workflows` / `manage:workflows` work on newer brands but not all. See [`permissions-and-scopes.md`](./permissions-and-scopes.md#workflows).

## Concepts

| Concept | What it is |
| --- | --- |
| **Workflow** | A definition: trigger + conditions + tasks. Has an ID (`WF_…`). Belongs to a survey, a directory, or the brand. |
| **Event** | The trigger. Examples: `survey.response`, `directory.contact.added`, `schedule` (cron-like), `api.usage.threshold`. |
| **Condition** | Optional boolean filter evaluated after the event. Only runs tasks if the condition passes. |
| **Task** | What actually happens. Examples: `email`, `webhook`, `xmdirectory.addcontact`, `salesforce.create`, `slack.message`. |
| **Run** | One execution of a workflow. Has a `runId` (`WR_…`), a status, and per-task outputs. |

## List workflows

```http
GET /API/v3/workflows?interpolateVariables=false&includeTaskTypes=true
X-API-TOKEN: {token}
```

Response:

```json
{
  "result": {
    "elements": [
      {
        "id": "WF_abc",
        "name": "Slack on new response",
        "ownerId": "UR_user123",
        "status": "active",
        "eventType": "survey.response",
        "surveyId": "SV_xyz",
        "taskTypes": ["slack.message"]
      }
    ],
    "nextPage": null
  }
}
```

Filter by survey with `?surveyId=SV_xyz`. Filter by owner with `?ownerId=UR_…`. Pagination via `nextPage`.

## Get a workflow

```http
GET /API/v3/workflows/{workflowId}
X-API-TOKEN: {token}
```

Returns the full definition: event config, conditions, task list with each task's config. Task configs contain secrets in some cases (e.g., Slack webhook URLs); the SDK will mark these `@secret` in its types (REQ-2.21).

## Create a workflow

```http
POST /API/v3/workflows
Content-Type: application/json
X-API-TOKEN: {token}

{
  "name": "Slack on new response",
  "surveyId": "SV_xyz",
  "event": { "type": "survey.response" },
  "tasks": [
    {
      "type": "slack.message",
      "config": {
        "webhookUrl": "https://hooks.slack.com/services/…",
        "text": "New application from ${q://QID5/ChoiceTextEntryValue}"
      }
    }
  ]
}
```

The payload shape for `event` and each `task` varies by type. The authoritative schema per task type lives in the Qualtrics [developer portal — Workflows](https://developer.qualtrics.com/developer/portal/documentation/122d11f886894-workflows-event) documentation. The SDK will provide typed task factories for the common set:

| Task type | Purpose |
| --- | --- |
| `email` | Send an email via Qualtrics-hosted mail. |
| `webhook` | POST JSON to an arbitrary URL. |
| `slack.message` | Post to Slack via incoming webhook. |
| `xmdirectory.addcontact` | Add or update a contact in a directory. |
| `code` | Run JS in Qualtrics' sandbox. |
| `salesforce.create` | Create a Salesforce record. |

## Trigger a workflow manually

Useful for testing:

```http
POST /API/v3/workflows/{workflowId}/run
Content-Type: application/json
X-API-TOKEN: {token}

{ "triggerData": { "responseId": "R_test123" } }
```

Returns the `runId`.

## Inspect run history

```http
GET /API/v3/workflows/{workflowId}/runs?status=failed&limit=10
X-API-TOKEN: {token}
```

and for a specific run:

```http
GET /API/v3/workflows/{workflowId}/runs/{runId}
X-API-TOKEN: {token}
```

The per-run payload includes each task's output and any error. This is the right endpoint to wire up if you want to build "what failed last night?" dashboards for a research workflow.

## Enabling / disabling

```http
PUT /API/v3/workflows/{workflowId}
Content-Type: application/json
X-API-TOKEN: {token}

{ "status": "inactive" }
```

Setting `status` to `inactive` stops the workflow firing without deleting it. `active` re-enables.

## Example

[`examples/ts/06-list-workflows.ts`](./examples/ts/06-list-workflows.ts) is a one-shot script that lists workflows. It is the example most likely to 403 on a survey-design-only token — intentional, so the forthcoming 403-enrichment behavior in [`runtime-scope-checks.md`](./runtime-scope-checks.md) has a concrete test case.

## See also

- [`permissions-and-scopes.md`](./permissions-and-scopes.md#workflows)
- [`request-for-permissions.md`](./request-for-permissions.md) — the fix for the 403 you are probably reading this doc because of.
- [`directory.md`](./directory.md) — directory-scoped workflows trigger on contact events.
