# Survey Platform

The surface the `qsurvey` SDK Spec 2 (REQ-2.1 to REQ-2.12) covers. Surveys, blocks, questions, flow, activation — the core of making a working survey via the API.

**Prerequisites:** Access API, plus Create Surveys / Edit Survey / Activate Survey on write endpoints. See [`permissions-and-scopes.md`](./permissions-and-scopes.md#survey-platform--surveys-blocks-questions-flow) for the full matrix.

## Concepts

- **Survey** — top-level container. Has an ID (`SV_…`), a name, metadata, and a set of blocks.
- **Block** — an ordered group of questions inside a survey. Has an ID (`BL_…`).
- **Question** — a single question. Has an ID (`QID1`, `QID2`, … in traditional order, or a generated ID like `QID_…` in newer surveys). Questions belong to blocks.
- **Flow** — the branching / randomization logic over blocks. Separate from block order.
- **Definition** — the full structured payload of a survey: metadata + blocks + questions + flow. Accessed under `/survey-definitions/{id}`. The plain `/surveys/{id}` endpoint returns a flatter summary.

> There are two parallel endpoint families: `/surveys/{id}` (summary, activation, some metadata) and `/survey-definitions/{id}` (the editable structure). Both accept the same survey ID. Use `/survey-definitions/{id}` for everything structural; use `/surveys/{id}` for activation and for reading the anonymous link.

## List surveys

```http
GET /API/v3/surveys
X-API-TOKEN: {token}
```

Returns a paginated result of surveys the caller owns or has shared access to. Use the `nextPage` field on the response `meta` block to paginate.

Example: [`examples/ts/01-auth-and-whoami.ts`](./examples/ts/01-auth-and-whoami.ts) includes a follow-on list call.

## Create a survey

```http
POST /API/v3/survey-definitions
Content-Type: application/json
X-API-TOKEN: {token}

{
  "SurveyName": "CSSA RFA 2026",
  "Language": "EN",
  "ProjectCategory": "CORE"
}
```

Response body includes the new `SurveyID`. Returns 200 on success (not 201, counterintuitively).

Example: [`examples/ts/02-create-survey.ts`](./examples/ts/02-create-survey.ts).

## Read a survey definition

```http
GET /API/v3/survey-definitions/{surveyId}
X-API-TOKEN: {token}
```

Returns the full editable structure: `Blocks`, `Questions`, `Flow`, `SurveyOptions`, `ResponseCounts`.

## Add a block

Every new survey ships with one default block. To add more:

```http
POST /API/v3/survey-definitions/{surveyId}/blocks
Content-Type: application/json
X-API-TOKEN: {token}

{
  "Type": "Standard",
  "Description": "Applicant background"
}
```

Response returns `BlockID`. Blocks are unordered in the API payload — order is determined by the `Flow`.

Example: [`examples/ts/03-add-block-and-questions.ts`](./examples/ts/03-add-block-and-questions.ts).

## Add a question

```http
POST /API/v3/survey-definitions/{surveyId}/questions?blockId={BL_...}
Content-Type: application/json
X-API-TOKEN: {token}

{
  "QuestionText": "What is your institutional affiliation?",
  "DataExportTag": "institution",
  "QuestionType": "TE",
  "Selector": "SL",
  "Configuration": {
    "QuestionDescriptionOption": "UseText"
  },
  "Validation": {
    "Settings": {
      "ForceResponse": "ON",
      "Type": "None"
    }
  }
}
```

The `QuestionType` + `Selector` pair determines the widget:

| QuestionType | Selector | Widget |
| --- | --- | --- |
| `MC` | `SAVR` | Single-answer multiple choice, vertical |
| `MC` | `MAVR` | Multi-answer multiple choice, vertical |
| `TE` | `SL` | Single-line text entry |
| `TE` | `ML` | Multi-line text entry |
| `TE` | `ESTB` | Essay text box |
| `Matrix` | `Likert` | Likert matrix |
| `FileUpload` | `FileUpload` | File upload |
| `DB` | `TB` | Descriptive (text block) |

> This is not the exhaustive list — Qualtrics supports dozens of combinations. The `qsurvey` SDK will expose typed factories (REQ-2.26) for the research-common subset; deeper coverage is added as real users ask for it (per the CSSA-RFA-led scope of v0).

## Update a question

```http
PUT /API/v3/survey-definitions/{surveyId}/questions/{questionId}
```

Request body is the same shape as the POST body, plus the `QuestionID`. Update is a full replace, not a patch — read the current state, merge, then PUT.

## Set the flow

```http
PUT /API/v3/survey-definitions/{surveyId}/flow
Content-Type: application/json
X-API-TOKEN: {token}

{
  "FlowID": "FL_1",
  "Type": "Root",
  "Flow": [
    { "Type": "Block", "ID": "BL_intro", "FlowID": "FL_2" },
    {
      "Type": "Branch",
      "FlowID": "FL_3",
      "Description": "Skip academia section for industry applicants",
      "BranchLogic": {
        "0": {
          "0": {
            "LogicType": "Question",
            "QuestionID": "QID5",
            "Operator": "EqualTo",
            "ChoiceLocator": "q://QID5/SelectableChoice/2"
          },
          "Type": "If"
        },
        "Type": "BooleanExpression"
      },
      "Flow": [
        { "Type": "Block", "ID": "BL_industry", "FlowID": "FL_4" }
      ]
    },
    { "Type": "Block", "ID": "BL_closing", "FlowID": "FL_5" },
    { "Type": "EndSurvey", "FlowID": "FL_6" }
  ]
}
```

The flow is a tree. The root has type `Root` and a children list. Branches wrap child blocks in `BranchLogic`. The full `BranchLogic` DSL is [documented by Qualtrics](https://api.qualtrics.com/) and is notorious for being verbose — the SDK will provide typed constructors for the common shapes.

## Activate a survey

```http
POST /API/v3/surveys/{surveyId}
Content-Type: application/json
X-API-TOKEN: {token}

{ "isActive": true }
```

Yes, activation is a `POST` to the survey ID with a payload, not a dedicated `/activate` endpoint. The `isActive: false` shape deactivates. (Some community references show a `/activate` sub-resource; it is not the officially documented v3 path, but it works on some brands. Prefer the `isActive` shape.)

Example: [`examples/ts/04-activate-and-get-link.ts`](./examples/ts/04-activate-and-get-link.ts).

## Retrieve the anonymous distribution link

The simplest way: the active survey's anonymous link is `https://{datacenter}.qualtrics.com/jfe/form/{surveyId}`. You can construct this client-side the moment you have a survey ID and a data center. The API also exposes it on the survey summary:

```http
GET /API/v3/surveys/{surveyId}
```

The `result.distributionLinks` object (when present) contains the anonymous link. On some brands the field is absent until at least one distribution has been created — in that case, use the constructed-URL fallback.

## Delete a survey

```http
DELETE /API/v3/survey-definitions/{surveyId}
X-API-TOKEN: {token}
```

Requires Delete Surveys permission. Destructive. There is no soft-delete in the API — deleted surveys are gone. The SDK will refuse to call this without an explicit `force: true` flag (REQ is implicit in the principle-of-least-surprise direction of Spec 2).

## Schema object (REQ-2.7)

The SDK represents a survey as a declarative schema object:

```ts
type QsurveyDefinition = {
  name: string;
  language: "EN" | string;
  blocks: Block[];
  flow: Flow;
  extensions?: Record<string, unknown>;  // REQ-2.27: preserve unknown fields
};

type Block = {
  id?: string;              // optional on create, required on update
  description: string;
  questions: Question[];
};

type Question =
  | MultipleChoiceQuestion
  | TextEntryQuestion
  | MatrixQuestion
  | FileUploadQuestion
  | DescriptiveBlock;
```

Serialization (REQ-2.8) and deserialization (REQ-2.9) are pure data transforms — no network. Idempotent sync (REQ-2.11, REQ-2.12) is the diffing call that reconciles a schema against a live survey and returns the changes.

## Display logic — read this before wiring up any "If yes, please specify"

**In-page display logic lives in `InPageDisplayLogic`, not `DisplayLogic`.** These are two separate fields on the question object. The editor reads both; the runtime reads only one. Writing to `DisplayLogic` for an in-page rule silently fails at runtime even though the editor shows the rule as correctly configured. See [`display-logic.md`](./display-logic.md) for the full story and [`gotchas.md`](./gotchas.md#inpagedisplaylogic-is-a-separate-field-from-displaylogic).

## Choice scaffolding — match what the UI writes

Questions created via the API are structurally indistinguishable from UI-created ones only when the SDK populates `ChoiceOrder`, `NextChoiceId`, `NextAnswerId`, `DataVisibility`, and `SearchSource` at creation time. Missing these fields doesn't produce an API error but is suspected to contribute to subtle runtime bugs, especially around display-logic choice resolution. See [`choice-fields.md`](./choice-fields.md) for the full field-by-field breakdown and `spec.md` REQ-2.32 / REQ-2.33.

## Verify after every update

Qualtrics' question PUT endpoint occasionally drops fields silently even when supplied (observed with `ForceResponse`; see CSSA `LESSONS.md` #14). Always run `sdk.verify(surveyId, schema)` after any sync to catch drift. See [`idempotent-sync.md`](./idempotent-sync.md) and `spec.md` REQ-2.35.

## See also

- [`permissions-and-scopes.md`](./permissions-and-scopes.md#survey-platform--surveys-blocks-questions-flow) — which permission each endpoint needs.
- [`responses-and-exports.md`](./responses-and-exports.md) — reading responses once the survey is live.
- [`distributions.md`](./distributions.md) — moving beyond the anonymous link.
- [`display-logic.md`](./display-logic.md) — the `InPageDisplayLogic` vs `DisplayLogic` story.
- [`choice-fields.md`](./choice-fields.md) — scaffolding fields the UI writes that API clients often miss.
- [`idempotent-sync.md`](./idempotent-sync.md) — how sync preserves UI-managed content across updates.
- [`survey-protection.md`](./survey-protection.md) — `BallotBoxStuffingPrevention` and the resubmission-prevention matrix.
- [`gotchas.md`](./gotchas.md) — the full catalogue of Qualtrics footguns.
