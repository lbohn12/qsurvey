# UI-parity fixtures

This directory holds canonical Qualtrics question payloads saved directly from the Qualtrics UI — not produced by the `qsurvey` SDK. They are the ground truth the SDK's `buildQuestionPayload` output is diffed against.

This satisfies [`spec.md`](../../spec.md) Spec 4 (REQ-4.1 through REQ-4.6).

## Why fixtures exist

Qualtrics' API surface has a parallel "visible-structure" model and "runtime-behavior" model that the editor reconciles invisibly (see [`docs/display-logic.md`](../../docs/display-logic.md)). The `DisplayLogic` vs `InPageDisplayLogic` trap is the worst example but not the only one; several question fields are populated by the UI on creation and not by hand-rolled API clients. Missing them doesn't produce API errors but may produce runtime bugs.

The fixture harness forces the SDK's output to match what the UI writes, byte-for-byte on runtime-critical fields. CI fails on drift; the error message names the exact field and links to the gotcha doc that explains why it matters.

## Contents

- `ui-snapshots/` — individual question JSON payloads, one per question type, saved from the Qualtrics UI.
- `field-classification.json` — the per-field classification ("runtime-critical" or "cosmetic") the diff respects.

## Regenerating a fixture

When the Qualtrics platform changes (quarterly is a sensible cadence; also after any platform release note touching survey structure), fixtures need to be re-snapshotted from a live brand.

1. **Create the canonical question in the Qualtrics UI.** Open a sandbox survey, add a question of the target type (e.g., MC/SAVR with Yes/No choices). Configure it with whatever options the fixture is meant to capture (e.g., "with InPageDisplayLogic" for the display-logic fixture — make the rule in the editor, with the In Page checkbox enabled).

2. **Fetch the live JSON via the API:**

   ```bash
   curl -H "X-API-TOKEN: $QUALTRICS_DEV_TOKEN" \
     "https://$QUALTRICS_DATA_CENTER.qualtrics.com/API/v3/survey-definitions/$SURVEY_ID" \
     | jq '.result.Questions["QID_xyz"]' \
     > ui-snapshots/mc-savr.2026-04.json
   ```

   Replace `QID_xyz` with the specific question's QID. The `jq` filter extracts just that question's payload; that's the shape the fixture test expects.

3. **Scrub identifying fields.** Remove `QuestionID` (tests should not be order-dependent). Replace specific survey IDs with placeholders if the fixture references them. The `QuestionText` and `Choices` can stay as-is.

4. **Commit with a dated filename.** `mc-savr.2026-04.json`, `te-sl.2026-04.json`, etc. The date makes it easy to notice which fixtures have been refreshed in recent Qualtrics versions and which are stale.

5. **Update `field-classification.json`** if the new fixture surfaces a field the SDK wasn't previously tracking. Decide: runtime-critical (diff failure blocks CI) or cosmetic (informational).

## The 10 baseline fixtures

Per `spec.md` REQ-4.1:

| Fixture | Covers | Status |
| --- | --- | --- |
| `mc-savr.json` | Single-answer MC, Yes/No style | TODO |
| `mc-macol.json` | Multi-answer MC, vertical column | TODO |
| `mc-mavr.json` | Multi-answer MC, vertical radio | TODO |
| `te-sl.json` | Text entry, single line | TODO |
| `te-ml.json` | Text entry, multi-line | TODO |
| `te-estb.json` | Essay text box | TODO |
| `matrix-likert.json` | Matrix question, Likert selector | TODO |
| `fileupload.json` | File upload question | TODO |
| `db-tb.json` | Descriptive (text block) | TODO |
| `te-sl-with-inpage-display-logic.json` | Text entry with `InPageDisplayLogic` gated on an MC parent | TODO |

When a fixture is added, flip its row to "✅ 2026-04" with the snapshot date.

## Field classification

`field-classification.json` is an object mapping dotted field paths to their classification:

```json
{
  "QuestionType": "runtime-critical",
  "Selector": "runtime-critical",
  "DataExportTag": "runtime-critical",
  "SubSelector": "runtime-critical",
  "Choices": "runtime-critical",
  "ChoiceOrder": "runtime-critical",
  "Validation.Settings.ForceResponse": "runtime-critical",
  "Validation.Settings.Type": "runtime-critical",
  "InPageDisplayLogic": "runtime-critical",
  "DisplayLogic": "runtime-critical",

  "Configuration.QuestionDescriptionOption": "cosmetic",
  "NextChoiceId": "cosmetic-probably",
  "NextAnswerId": "cosmetic-probably",
  "DataVisibility": "cosmetic",
  "SearchSource": "cosmetic",
  "QuestionText_Unsafe": "cosmetic",
  "Language": "runtime-critical-for-FileUpload"
}
```

The "-probably" suffix on `NextChoiceId` and `NextAnswerId` is deliberate: there's an open investigation from the origin project a production cohort debugging (see the internal post-mortem) about whether these fields contribute to the display-logic no-render bug. The classification is hedged pending a test survey that can isolate the variable.

## How the test consumes these

`tests/ui-parity.test.ts` (stub present; real implementation ships with SDK v0) loads each fixture file, invokes the corresponding SDK builder, and compares the output. For each field in `field-classification.json`:

- **runtime-critical:** diff must match exactly; mismatch fails the test.
- **cosmetic:** diff is reported but does not fail the test.
- **cosmetic-probably:** diff is reported as a warning. Promote to runtime-critical if a new the origin project-style bug surfaces and the investigation confirms the field matters.

## Non-goals

- **Not integration tests.** Fixtures are static; no network calls at test time.
- **Not a schema validator.** Fixtures are reference examples, not an exhaustive schema.
- **Not a substitute for real end-to-end testing.** Fixture passing means "the SDK produces the same payload shape the UI does." It does NOT mean "the produced survey behaves correctly at runtime" — that still needs manual verification via a live submission flow, because the runtime's behavior can depend on Qualtrics internals the API doesn't expose.

## See also

- [`spec.md`](../../spec.md) — Spec 4 requirements
- [`docs/display-logic.md`](../../docs/display-logic.md) — the field-name bug that motivated this harness
- [`docs/choice-fields.md`](../../docs/choice-fields.md) — field-by-field breakdown of question payloads
- [`docs/gotchas.md`](../../docs/gotchas.md) — the broader footgun catalogue
- the internal post-mortem — the post-mortems
