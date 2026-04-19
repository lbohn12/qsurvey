# Choice fields — what the UI writes that the API doesn't

Every Qualtrics question — multiple choice, text entry, matrix, file upload — carries a collection of scaffolding fields that the UI populates automatically on creation. Hand-rolled API payloads typically omit most of them. Questions still "work" in the editor, but subtle runtime bugs can surface when display logic references their choices, or when the question participates in loops, randomization, or advanced piping.

This doc enumerates the scaffolding fields, which the `qsurvey` SDK populates by default, which are runtime-load-bearing, and which are cosmetic-for-the-editor.

**Prerequisites:** Familiarity with [`survey-platform.md`](./survey-platform.md).

## The fields

### Required for correct behavior

| Field | When needed | Effect if missing |
| --- | --- | --- |
| `QuestionText` | Always | Question renders as empty. |
| `QuestionType` | Always | API rejects with 400. |
| `DataExportTag` | Always | Exported data column name defaults to `QIDxxx`; downstream pipelines break on re-seed. |
| `Selector` | Always | API rejects or renders wrong widget. |
| `SubSelector` | MC, Matrix | For MC: `"TX"` is always required. Without it, API may return 400. For Matrix: varies (`SingleAnswer`, `MultipleAnswer`, etc.). |
| `Choices` | MC, Matrix | Question renders with no options. |
| `Configuration.QuestionDescriptionOption` | Always, for predictable editor behavior | UI shows "missing question text" warnings. |
| `Validation.Settings.Type` | Required-or-not questions | API rejects if absent. |
| `Validation.Settings.ForceResponse` | Required questions | `"ON"` for required, `"OFF"` otherwise. Intermittently dropped by PUT updates — see `LESSONS.md` #14. |

### Scaffolding the UI adds that API clients omit (and probably shouldn't)

| Field | Applies to | What it does | Runtime-critical? |
| --- | --- | --- | --- |
| `ChoiceOrder` | MC | Ordered array of choice keys (`["1", "2"]`) defining display order. Without it, order falls back to dict-insertion order, which may or may not match what the caller intended. | **Probably yes** — suspected contributor to display-logic choice-resolution bugs (CSSA `LESSONS.md` #15 open investigation). Always set. |
| `NextChoiceId` | MC | Numeric field the UI uses to know what ID to assign the next-added choice. | Unclear — UI-only as far as we know, but the fixture harness includes it for parity. |
| `NextAnswerId` | Matrix, MC with row labels | Same role as `NextChoiceId` but for answer rows. | Unclear; same disposition as above. |
| `DataVisibility` | All | Object with `Private` and `Hidden` booleans. Controls whether the field is visible in data & analysis / exports. | Sometimes yes (hiding a field in data-protection scenarios). Default is `{ "Private": false, "Hidden": false }`. |
| `SearchSource` | TE with prefill / autofill | Configures autocomplete source for text-entry questions. Defaults to empty/null. | No on default questions; required for autocomplete to work. |
| `Language` | FileUpload, some TE | Array of locale codes. For FileUpload, must be `[]` or API returns 400. | Yes for FileUpload. |

### Display-logic-specific (see `display-logic.md`)

| Field | Runtime-critical? |
| --- | --- |
| `InPageDisplayLogic` | **YES, for in-page logic.** Writing to `DisplayLogic` instead silently fails. |
| `DisplayLogic` | Only for cross-page logic. Do not use for same-page show/hide behavior. |

## SDK enforcement

Per [`spec.md`](../spec.md):

- **REQ-2.32** — `ChoiceOrder` is derived from ordered choice keys and always included on MC questions, even when the caller didn't supply it.
- **REQ-2.33** — `NextChoiceId`, `NextAnswerId`, `DataVisibility`, and `SearchSource` are populated with UI-default values on question creation, so API-created questions are structurally indistinguishable from UI-created ones.

The fixture harness (Spec 4) asserts byte-for-byte parity against UI-saved snapshots — any drift fails CI with a message naming the exact field and linking to this doc.

## Why we don't know everything

There's an open question documented in CSSA `LESSONS.md` #13/#15: even after the `InPageDisplayLogic` field-name fix and explicit `ChoiceOrder` population, a test case on CSSA Cohort 2.0 still didn't render display-logic follow-ups. We shipped with "always display" as a workaround and tagged the issue for Cohort 3.0 investigation.

The hypothesis in the CSSA repo: one or more of `NextChoiceId`, `DataVisibility`, or `SearchSource` may be load-bearing for display-logic choice resolution in ways not yet characterized. The fixture harness is designed to test this theory incrementally — every time a new fixture reveals a runtime-critical field, it gets classified in `tests/fixtures/field-classification.json` and a new gotcha entry gets written.

The practical recommendation until the investigation completes: always populate every scaffolding field the SDK knows about. The cost is low (a few extra bytes on the wire); the benefit is removing one more variable when runtime bugs appear.

## Default values the SDK uses

```jsonc
{
  // For every new MC question:
  "ChoiceOrder": ["1", "2", /* ... */],
  "NextChoiceId": 10,  // next ID the UI would have used; computed as max(choice keys) + 1
  "NextAnswerId": 1,
  "DataVisibility": { "Private": false, "Hidden": false },
  "SearchSource": null,  // or { "AllowFreeResponse": false } for newer brands

  // For FileUpload:
  "Language": []
}
```

The fixture harness at `tests/fixtures/ui-snapshots/*.json` encodes these across the 10 baseline question types.

## See also

- [`display-logic.md`](./display-logic.md) — the display-logic fields and their parallel model
- [`survey-platform.md`](./survey-platform.md) — the question-type matrix
- `tests/fixtures/README.md` — how to add a new fixture when you discover a UI-written field the SDK isn't setting
- CSSA `LESSONS.md` #13, #14, #15 — related investigations
