/**
 * Example 10 — Post-submit flow branch guard ("already submitted" routing).
 *
 * Builds a Branch flow element at the top of the survey flow that evaluates
 * an embedded-data flag (`submission_status == "submitted"`) and routes
 * completed responses to a terminal block before any other survey blocks run.
 *
 * Paired with an EmbeddedData setter at the end of the flow that sets the flag.
 *
 * Demonstrates REQ-2.38 from spec.md. See docs/survey-protection.md for where
 * this fits in the overall protection stack and why it's a secondary defense
 * behind BallotBoxStuffingPrevention (example 12).
 *
 * Required user permissions: Access API, Edit Survey.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 ALREADY_SUBMITTED_BLOCK_ID=BL_xyz \
 *     QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/10-flow-branch-guard.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;
const alreadySubmittedBlockId = process.env.ALREADY_SUBMITTED_BLOCK_ID;

if (!token || !dc || !surveyId || !alreadySubmittedBlockId) {
  console.error(
    "Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, SURVEY_ID, ALREADY_SUBMITTED_BLOCK_ID."
  );
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

function buildBranchGuard(terminalBlockId: string, fl: number) {
  return {
    Type: "Branch",
    FlowID: `FL_${fl}`,
    Description: "Already-submitted guard",
    BranchLogic: {
      "0": {
        "0": {
          LogicType: "EmbeddedField",
          LeftOperand: "submission_status",
          Operator: "EqualTo",
          RightOperand: "submitted",
          Type: "Expression",
          Description: "<span>If submission_status Is Equal to submitted</span>",
        },
        Type: "If",
      },
      Type: "BooleanExpression",
    },
    Flow: [
      { Type: "Block", ID: terminalBlockId, FlowID: `FL_${fl + 1}` },
      { Type: "EndSurvey", FlowID: `FL_${fl + 2}` },
    ],
  };
}

function buildStatusSetter(fl: number) {
  return {
    Type: "EmbeddedData",
    FlowID: `FL_${fl}`,
    EmbeddedData: [
      {
        Description: "submission_status",
        Type: "Recipient",
        Field: "submission_status",
        VariableType: "String",
        DataVisibility: { Private: false, Hidden: false },
        AnalyzeText: false,
        Value: "submitted",
      },
    ],
  };
}

async function main() {
  // 1. Fetch the current flow.
  const defRes = await fetch(`${base}/survey-definitions/${surveyId}`, {
    headers: { "X-API-TOKEN": token! },
  });
  const def: any = (await defRes.json()).result;
  const existingFlow: any[] = def.SurveyFlow.Flow;

  // 2. Check for existing guard / setter to keep this idempotent.
  const hasGuard = existingFlow.some(
    (el) =>
      el.Type === "Branch" &&
      el.BranchLogic?.["0"]?.["0"]?.LeftOperand === "submission_status" &&
      el.BranchLogic?.["0"]?.["0"]?.RightOperand === "submitted"
  );
  const hasSetter = existingFlow.some(
    (el) =>
      el.Type === "EmbeddedData" &&
      (el.EmbeddedData ?? []).some(
        (ed: any) => ed.Field === "submission_status" && ed.Value === "submitted"
      )
  );

  let newFlow = [...existingFlow];
  let fl = 100;
  if (!hasGuard) {
    newFlow.unshift(buildBranchGuard(alreadySubmittedBlockId!, fl));
    fl += 10;
  }
  if (!hasSetter) {
    // Insert before the last top-level EndSurvey.
    const lastEndIdx = newFlow.map((el, i) => (el.Type === "EndSurvey" ? i : -1)).filter((i) => i >= 0).pop();
    const setter = buildStatusSetter(fl);
    if (lastEndIdx !== undefined) newFlow.splice(lastEndIdx, 0, setter);
    else newFlow.push(setter);
  }

  if (hasGuard && hasSetter) {
    console.log("flow already guarded; no changes.");
    return;
  }

  // 3. PUT the new flow.
  const putRes = await fetch(`${base}/survey-definitions/${surveyId}/flow`, {
    method: "PUT",
    headers: { "X-API-TOKEN": token!, "Content-Type": "application/json" },
    body: JSON.stringify({ FlowID: "FL_1", Type: "Root", Flow: newFlow }),
  });
  if (!putRes.ok) {
    console.error(`PUT flow failed: ${putRes.status}`);
    console.error(await putRes.text());
    process.exit(5);
  }
  console.log("branch guard + submission_status setter installed; publish to make live.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
