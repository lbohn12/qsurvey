# Permissions and scopes

This is a best-effort working map between **API endpoints**, **Qualtrics user permissions** (for personal API tokens), and **OAuth 2.0 scopes** (for OAuth clients). It is not an authoritative or exhaustive permission matrix. Qualtrics permissions, available endpoints, and OAuth behavior can vary by license, brand configuration, and account. Read [coverage and limitations](./coverage-and-limitations.md) before relying on a row.

If your call to Qualtrics returns a 403, start here.

## How to read this matrix

Each section below covers one API area. The columns are:

- **Endpoint** — the HTTP method and `/API/v3/` path.
- **Purpose** — what the endpoint does in one line.
- **User permission** — a likely admin-UI permission requirement for a personal API token. Names generally follow labels in the Qualtrics admin UI; confirm them with your brand administrator.
- **OAuth scope** — a scope string to check against the official API reference and OAuth client configuration. Notes marked with a tenant observation are not a guarantee for other brands.
- **Typical failure symptom** — what you see when the permission/scope is missing, so you can recognize the shape from an error log.

> Qualtrics' [user permissions documentation](https://www.qualtrics.com/support/survey-platform/sp-administration/managing-users/user-permissions/) describes Access API as the permission for v3 API access. Confirm effective permissions for your account with your brand administrator and a harmless `GET /API/v3/whoami` request.

## Admin-UI label → permission key

Qualtrics' admin UI uses friendly labels that do not always match the permission keys in API error messages. When a 403 message names a permission you cannot find in the admin UI, translate it here:

| Admin-UI label | Permission key (as seen in API errors) | Notes |
| --- | --- | --- |
| Access API | `useApi` | Master switch. Required for every personal-token call. |
| Create Surveys | `createSurveys` | Gate for survey creation. |
| Edit Survey | `editSurvey` / `editSurveys` | Gate for updating an existing survey and its blocks, questions, flow. |
| Copy Surveys | `copySurveys` | Separate from create. |
| Delete Surveys | `deleteSurveys` | Separate from edit. |
| Activate Survey | `activateSurveys` | Gate for publishing. |
| Use Survey Library | `useSurveyLibrary` | Needed to read template / shared survey libraries. |
| View Response Data | `viewResponseData` | Gate for the response-export endpoints. |
| Download Response Data | `downloadResponseData` | Additional gate on the final file download step in export jobs. |
| Manage Contacts (Legacy) | `manageContacts` | Legacy mailing-list-only contact management. |
| Access XM Directory | `accessContactsDirectory` | Gate for the `/directories/{dirId}/contacts` family. |
| Edit XM Directory | `editContactsDirectory` | Required for directory writes. |
| Manage Directories | `manageDirectory` | Brand-admin-level directory permission. Implies the two above. |
| Distribute Surveys | `distributeSurveys` | Gate for mailing-list distributions and reminders. |
| Manage Workflows Across Projects | `manageWorkflows` | Reported by one account as necessary for workflow calls; verify for your brand. |
| Manage Users | `manageUsers` | Brand-admin-level. Required for `/users` writes. |
| View Users | `viewUsers` | Required for `GET /users`. |
| Manage Groups | `manageGroups` | Brand-admin-level. Required for `/groups/*`. |
| Manage Divisions | `manageDivisions` | Brand-admin-level. Required for `/divisions/*`. |

> Group and division settings can affect effective access. Check `GET /API/v3/whoami` where available and ask your brand administrator to confirm effective permissions.

## Survey Platform — surveys, blocks, questions, flow

**Prerequisites:** `Access API`. Most write endpoints also require `Create Surveys` or `Edit Survey`.

| Endpoint | Purpose | User permission | OAuth scope | Typical failure symptom |
| --- | --- | --- | --- | --- |
| `GET /surveys` | List surveys owned by or shared with the caller. | (none beyond Access API) | `read:surveys` *(one-tenant test returned insufficient_scope)* | One tested OAuth client returned 403 with only `read:surveys`; verify on your brand. |
| `POST /surveys` | Create a new empty survey. | Create Surveys | `manage:surveys` | 403 with `permissionDenied` and key `createSurveys`. |
| `GET /surveys/{id}` | Get survey metadata. | (owner or shared) | `read:surveys` | 404 if not shared with the caller (sometimes, confusingly, instead of 403). |
| `PUT /surveys/{id}` | Update survey metadata (name, expiration, isActive). | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `DELETE /surveys/{id}` | Delete a survey. | Delete Surveys | `manage:surveys` | 403 `deleteSurveys`. |
| `GET /survey-definitions/{id}` | Get the full structured definition (blocks, questions, flow). | (owner or shared) | `read:surveys` | 403 on OAuth with narrow scope — `manage:all` works. |
| `PUT /survey-definitions/{id}` | Replace the full survey definition. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `POST /survey-definitions/{id}/blocks` | Create a block. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `PUT /survey-definitions/{id}/blocks/{blockId}` | Update a block. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `DELETE /survey-definitions/{id}/blocks/{blockId}` | Delete a block. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `POST /survey-definitions/{id}/questions` | Create a question. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `PUT /survey-definitions/{id}/questions/{qid}` | Update a question. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `DELETE /survey-definitions/{id}/questions/{qid}` | Delete a question. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `GET /survey-definitions/{id}/flow` | Get the survey flow (branching, randomization). | (owner or shared) | `read:surveys` | 404 as a shape-403 if not shared. |
| `PUT /survey-definitions/{id}/flow` | Replace the survey flow. | Edit Survey | `manage:surveys` | 403 `editSurveys`. |
| `POST /surveys/{id}/activate` | Activate (open) the survey. | Activate Survey | `manage:surveys` | 403 `activateSurveys`. |
| `POST /surveys/{id}/deactivate` | Deactivate (close) the survey. | Activate Survey | `manage:surveys` | 403 `activateSurveys`. |

See [`survey-platform.md`](./survey-platform.md) for request/response shapes and examples.

## Responses and exports

**Prerequisites:** `Access API`, `View Response Data`. Downloading the resulting file additionally requires `Download Response Data`.

| Endpoint | Purpose | User permission | OAuth scope | Typical failure symptom |
| --- | --- | --- | --- | --- |
| `POST /surveys/{id}/export-responses` | Start an async export job. | View Response Data | `read:survey_responses` *(verify by format and tenant)* | Check the response body; format and permission errors may have different status codes. |
| `GET /surveys/{id}/export-responses/{progressId}` | Poll job progress. | View Response Data | `read:survey_responses` | 403 `viewResponseData`. |
| `GET /surveys/{id}/export-responses/{fileId}/file` | Download the finished file (zipped). | View Response Data **and** Download Response Data | `read:survey_responses` | 403 `downloadResponseData` even when you can see progress. |
| `POST /surveys/{id}/import-responses` | Bulk-import responses. | Edit Survey | `manage:survey_responses` | 403 `editSurveys`; format mismatch surfaces as 400. |
| `GET /responses/{responseId}` *(deprecated)* | Get a single response. Prefer the export flow. | View Response Data | `read:survey_responses` | 410 Gone on newer brands. |
| `PUT /responses/{responseId}` | Update a response (embedded data, etc.). | Edit Survey | `manage:survey_responses` | 403 `editSurveys`. |
| `DELETE /responses/{responseId}` | Delete a response. | Edit Survey | `manage:survey_responses` | 403 `editSurveys`. |

See [`responses-and-exports.md`](./responses-and-exports.md) for the async job pattern.

## Distributions

**Prerequisites:** `Access API`. Most endpoints additionally require `Distribute Surveys`. Mailing-list-backed distributions also require directory permissions — see the directory section.

| Endpoint | Purpose | User permission | OAuth scope | Typical failure symptom |
| --- | --- | --- | --- | --- |
| `GET /surveys/{id}/anonymous-link` *(or `GET /distributions/anonymous-link`)* | Retrieve the anonymous distribution link. | (owner or shared) | `read:surveys` | Endpoint path has shifted over time; fall back to reading the `distributionLinks` field on the survey object. |
| `POST /distributions` | Create a mailing-list distribution. | Distribute Surveys + Access XM Directory | `manage:distributions` | 403 `distributeSurveys` or `accessContactsDirectory`. |
| `GET /distributions` | List distributions on a survey. | Distribute Surveys | `read:distributions` *(one-tenant test returned insufficient_scope)* | Verify the required scope and user permission on your brand. |
| `GET /distributions/{id}` | Get distribution details. | Distribute Surveys | `read:distributions` | 403. |
| `POST /distributions/{id}/reminders` | Send a reminder to non-respondents. | Distribute Surveys | `manage:distributions` | 403. |
| `POST /distributions/{id}/thankyous` | Send a thank-you to respondents. | Distribute Surveys | `manage:distributions` | 403. |

See [`distributions.md`](./distributions.md) for examples.

## Workflows

**Prerequisites:** `Access API`. One tenant also required `Manage Workflows Across Projects`; confirm workflow access for your account.

> One account received 403 responses on workflow endpoints until its workflow permission was enabled. Treat this as a troubleshooting clue; check the current permission labels and requirements for your brand. See [`request-for-permissions.md`](./request-for-permissions.md).

| Endpoint | Purpose | User permission | OAuth scope | Typical failure symptom |
| --- | --- | --- | --- | --- |
| `GET /workflows` | List workflows. | Manage Workflows Across Projects | `read:workflows` *(one-tenant test returned insufficient_scope)* | Verify the required scope and user permission on your brand. |
| `POST /workflows` | Create a workflow. | Manage Workflows Across Projects | `manage:workflows` | 403 `manageWorkflows`. |
| `GET /workflows/{id}` | Get a workflow definition. | Manage Workflows Across Projects | `read:workflows` | 403 `manageWorkflows`. |
| `PUT /workflows/{id}` | Update a workflow. | Manage Workflows Across Projects | `manage:workflows` | 403 `manageWorkflows`. |
| `DELETE /workflows/{id}` | Delete a workflow. | Manage Workflows Across Projects | `manage:workflows` | 403 `manageWorkflows`. |
| `POST /workflows/{id}/run` | Manually trigger a workflow. | Manage Workflows Across Projects | `manage:workflows` | 403 `manageWorkflows`. |
| `GET /workflows/{id}/runs` | List historical runs. | Manage Workflows Across Projects | `read:workflows` | 403 `manageWorkflows`. |
| `GET /workflows/{id}/runs/{runId}` | Get a specific run, including task output. | Manage Workflows Across Projects | `read:workflows` | 403 `manageWorkflows`. |

See [`workflows.md`](./workflows.md) for event/task concepts.

## Directory (XM Directory)

**Prerequisites:** `Access API`, `Access XM Directory` for reads, `Edit XM Directory` for writes. Brand-admin-level operations additionally require `Manage Directories`.

Directory endpoints are scoped to a specific directory ID (often called "pool ID" in older docs). A brand typically has one directory; large enterprises have multiple, often one per division.

| Endpoint | Purpose | User permission | OAuth scope | Typical failure symptom |
| --- | --- | --- | --- | --- |
| `GET /directories` | List directories you can access. | Access XM Directory | `read:directories` | 403 `accessContactsDirectory`. |
| `GET /directories/{dirId}/contacts` | List contacts. | Access XM Directory | `read:directory_contacts` | 403 `accessContactsDirectory`. |
| `POST /directories/{dirId}/contacts` | Add a contact. | Edit XM Directory | `manage:directory_contacts` | 403 `editContactsDirectory`. |
| `GET /directories/{dirId}/contacts/{cid}` | Get a contact. | Access XM Directory | `read:directory_contacts` | 403. |
| `PUT /directories/{dirId}/contacts/{cid}` | Update a contact. | Edit XM Directory | `manage:directory_contacts` | 403. |
| `DELETE /directories/{dirId}/contacts/{cid}` | Delete a contact. | Edit XM Directory | `manage:directory_contacts` | 403. |
| `GET /directories/{dirId}/mailinglists` | List mailing lists. | Access XM Directory | `read:mailing_lists` | 403. |
| `POST /directories/{dirId}/mailinglists` | Create a mailing list. | Edit XM Directory | `manage:mailing_lists` | 403. |
| `POST /directories/{dirId}/transactions` | Record contact transactions (for EX/CX). | Edit XM Directory + additional brand configuration | `manage:directory_contacts` | 403 or 400 if transaction schema is not configured. |

### Users and groups

| Endpoint | Purpose | User permission | OAuth scope | Typical failure symptom |
| --- | --- | --- | --- | --- |
| `GET /users` | List users in the brand. | View Users | `read:users` | 403 `viewUsers`. Brand-admin only in most tenants. |
| `POST /users` | Create a user. | Manage Users | `manage:users` | 403 `manageUsers`. |
| `GET /users/{uid}` | Get a user. | View Users | `read:users` | 403. |
| `PUT /users/{uid}` | Update a user (including their permissions). | Manage Users | `manage:users` | 403. |
| `GET /groups` | List groups. | Manage Groups | `read:groups` | 403 `manageGroups`. |
| `POST /groups` | Create a group. | Manage Groups | `manage:groups` | 403. |
| `GET /whoami` | Introspect the caller's user + permissions. | Access API for personal tokens | No scope listed here; confirm for OAuth | Use as a preflight where available. |

See [`directory.md`](./directory.md) for examples.

## Starting permissions for a survey-creation script

For the planned PDF-to-survey CLI, these permissions are a starting point based on the operations it is designed to perform. Confirm the specific requirements for your brand:

- ✅ **Access API** — prerequisite.
- ✅ **Create Surveys** — to create the survey from the parsed PDF.
- ✅ **Edit Survey** — to add blocks, questions, and flow.
- ✅ **Activate Survey** — to publish.
- ⬜ *View Response Data* — not required for v0; needed later if you want `qsurvey responses export`.
- ⬜ *Distribute Surveys* — not required for v0; the anonymous link is read off the survey object.
- ⬜ *Manage Workflows Across Projects* — not required for v0.
- ⬜ *Access/Edit XM Directory* — not required for v0.

The v0 CLI's `qsurvey doctor` subcommand (specified in [`runtime-scope-checks.md`](./runtime-scope-checks.md)) is the runtime analogue of this table — it probes each area and prints which permissions are present.
