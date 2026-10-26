/**
 * Example 13 — Verify a live survey against a schema and report drift.
 *
 * Demonstrates REQ-2.35 from spec.md — the verify method that catches the
 * intermittent field-drop bug (this guide), display-logic
 * field-placement errors (this guide), and options regressions after
 * manual UI edits.
 *
 * The real SDK abstracts this into `await sdk.verify(surveyId, schema)`. This
 * example is the reference implementation shape.
 *
 * Required user permissions: Access API.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/13-verify-drift.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;

if (!token || !dc || !surveyId) {
  console.error("Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, SURVEY_ID.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

// A tiny schema of what we expect to be true. Real schemas come from the
// caller; this is a minimal demo.
const expectedSchema = {
  // Every question with a DataExportTag in this set must have ForceResponse ON.
  requiredQuestionTags: new Set(["respondent_name", "respondent_email"]),

  // Every question with a DataExportTag in this set must have InPageDisplayLogic
  // (not DisplayLogic) set, referencing a parent-qid condition.
  mustHaveInPageDisplayLogic: new Set(["specify_other"]),

  // Options we want on.
  mustBeSet: {
    BallotBoxStuffingPrevention: "true",
    SaveAndContinue: "true",
  },
};

type Drift =
  | { kind: "force-response-missing"; tag: string; qid: string }
  | { kind: "display-logic-in-wrong-field"; tag: string; qid: string }
  | { kind: "option-wrong-value"; option: string; expected: unknown; got: unknown };

async function main() {
  const res = await fetch(`${base}/survey-definitions/${surveyId}`, {
    headers: { "X-API-TOKEN": token! },
  });
  const def: any = (await res.json()).result;

  const drifts: Drift[] = [];

  // 1. ForceResponse checks (catches this guide).
  for (const [qid, q] of Object.entries<any>(def.Questions)) {
    const tag = q.DataExportTag;
    if (!expectedSchema.requiredQuestionTags.has(tag)) continue;
    const fr = q.Validation?.Settings?.ForceResponse;
    if (fr !== "ON") {
      drifts.push({ kind: "force-response-missing", tag, qid });
    }
  }

  // 2. Display-logic field-placement checks (catches this guide).
  for (const [qid, q] of Object.entries<any>(def.Questions)) {
    const tag = q.DataExportTag;
    if (!expectedSchema.mustHaveInPageDisplayLogic.has(tag)) continue;
    if (!q.InPageDisplayLogic && q.DisplayLogic) {
      drifts.push({ kind: "display-logic-in-wrong-field", tag, qid });
    }
  }

  // 3. Survey-option checks.
  for (const [opt, expected] of Object.entries(expectedSchema.mustBeSet)) {
    const got = def.SurveyOptions?.[opt];
    if (got !== expected) {
      drifts.push({ kind: "option-wrong-value", option: opt, expected, got });
    }
  }

  if (drifts.length === 0) {
    console.log("✅ no drift");
    return;
  }

  console.error(`⚠️  ${drifts.length} drift(s) detected:`);
  for (const d of drifts) {
    switch (d.kind) {
      case "force-response-missing":
        console.error(
          `  [${d.tag} / ${d.qid}] ForceResponse expected ON — re-push to reconcile. See this guide.`
        );
        break;
      case "display-logic-in-wrong-field":
        console.error(
          `  [${d.tag} / ${d.qid}] Display logic in DisplayLogic field instead of InPageDisplayLogic. See docs/display-logic.md.`
        );
        break;
      case "option-wrong-value":
        console.error(
          `  [${d.option}] expected "${d.expected}", got "${d.got}". See docs/survey-protection.md.`
        );
        break;
    }
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
