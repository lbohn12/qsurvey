# Responses and exports

Reading survey responses from Qualtrics is **not** a synchronous GET. It is a three-step async job. This is the single most common source of confusion for new Qualtrics API users, and the reason naïve scripts time out or appear to "return nothing."

**Prerequisites:** Access API, View Response Data, and — for the final download step — Download Response Data. See [`permissions-and-scopes.md`](./permissions-and-scopes.md#responses-and-exports).

## The three-step export pattern

1. **Start a job.** POST to `/surveys/{id}/export-responses` with the requested format and filters. Qualtrics returns a `progressId` (not the data).
2. **Poll the job.** GET `/surveys/{id}/export-responses/{progressId}` until `status == "complete"`. The completed response includes a `fileId`.
3. **Download the file.** GET `/surveys/{id}/export-responses/{fileId}/file`. Qualtrics returns a zipped file; unzip it to get the CSV / JSON / SPSS / TSV.

### Step 1: start the job

```http
POST /API/v3/surveys/{surveyId}/export-responses
Content-Type: application/json
X-API-TOKEN: {token}

{
  "format": "json",
  "startDate": "2026-01-01T00:00:00Z",
  "endDate":   "2026-04-18T00:00:00Z",
  "compress":  true,
  "useLabels": false,
  "seenUnansweredRecode": -99
}
```

Response:

```json
{ "result": { "progressId": "ES_abc123", "percentComplete": 0.0, "status": "inProgress" } }
```

| Format | Notes |
| --- | --- |
| `json` | Easiest to parse. Each line of the unzipped file is one response as JSON. |
| `csv` | Default for statistical tools. |
| `tsv` | Same as CSV, tab-separated. |
| `spss` | `.sav`. Requires the same permissions plus brand-level SPSS export enablement on some tenants. |
| `ndjson` | Available on newer brands. |

### Step 2: poll

```http
GET /API/v3/surveys/{surveyId}/export-responses/{progressId}
X-API-TOKEN: {token}
```

Response while running:

```json
{ "result": { "percentComplete": 42.0, "status": "inProgress", "continuationToken": null } }
```

Response when done:

```json
{ "result": { "percentComplete": 100.0, "status": "complete", "fileId": "abc123" } }
```

**Polling cadence.** Qualtrics does not publish a recommended interval. Empirically: start at 1s, back off to 5s for long exports. Respect `X-RateLimit-Remaining` — see [`authentication.md`](./authentication.md#rate-limits). A one-year export on a large RFA survey can take 30–90 seconds; do not time out your polling loop under 2 minutes.

### Step 3: download

```http
GET /API/v3/surveys/{surveyId}/export-responses/{fileId}/file
X-API-TOKEN: {token}
```

Response is a binary zip. Content-Type is `application/zip`. The zip contains exactly one file named `{surveyName}.json` (or `.csv` / `.sav` etc.). Unzip and parse.

Example: [`examples/ts/05-export-responses.ts`](./examples/ts/05-export-responses.ts) wraps the whole three-step flow, including backoff polling.

## Filtering

The POST body accepts these filter fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `startDate` / `endDate` | ISO 8601 UTC | Filter by response recorded date. |
| `surveyMetadataIds` | string[] | Only include responses where these metadata fields are set. |
| `questionIds` | string[] | Only include these questions in the export. Saves bandwidth on wide surveys. |
| `embeddedDataIds` | string[] | Only include these embedded data fields. |
| `limit` | number | Cap the number of responses returned. Useful for sampling. |
| `includeDisplayOrder` | boolean | Include randomization display order. Off by default. |
| `useLabels` | boolean | Export answer labels instead of numeric codes. |
| `seenUnansweredRecode` | number | Value to use for seen-but-unanswered questions. |

## Pagination for brands with millions of responses

On large brands a single export-responses job that filters nothing can exceed Qualtrics' internal size limit. The response then includes a `continuationToken` on the final poll. Re-issue the same POST with `continuationToken` set and `startDate` / `endDate` omitted; continue until no token is returned. The SDK (REQ-2.4) will abstract this into a single async iterator.

## Updating and deleting responses

Individual responses can be updated:

```http
PUT /API/v3/responses/{responseId}
X-API-TOKEN: {token}

{ "embeddedData": { "reviewerScore": 0.87 } }
```

and deleted:

```http
DELETE /API/v3/responses/{responseId}
```

Both require **Edit Survey** permission on the survey that owns the response — not just View Response Data. This catches people out.

## Importing responses

Bulk import via `POST /surveys/{id}/import-responses` with a CSV or JSON payload matching the survey structure. Requires Edit Survey + `manage:survey_responses` OAuth scope. Rarely needed for qsurvey's v0 use cases; documented for completeness.

## See also

- [`permissions-and-scopes.md`](./permissions-and-scopes.md#responses-and-exports)
- [`authentication.md`](./authentication.md#rate-limits) — the polling loop interacts with rate limits.
- [`workflows.md`](./workflows.md) — a "response recorded" event can push responses to you instead of you polling.
