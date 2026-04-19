/**
 * Example 08 — Configure InPageDisplayLogic (the correct field) on a child question.
 *
 * This is the fix for the CSSA RFA 2 bug documented in docs/display-logic.md and
 * docs/gotchas.md#inpagedisplaylogic-is-a-separate-field-from-displaylogic.
 *
 * Demonstrates REQ-2.28, REQ-2.29, REQ-2.30 from spec.md:
 *   - Write the rule to InPageDisplayLogic, not DisplayLogic.
 *   - Include the QuestionIDFromLocator and LeftOperand placeholder fields.
 *   - Use the CSS-classed span structure for Description.
 *
 * Required user permissions: Access API, Edit Survey.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 PARENT_QID=QID10 CHILD_QID=QID11 \
 *     QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/08-display-logic-inpage.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;
const parentQid = process.env.PARENT_QID;
const childQid = process.env.CHILD_QID;

if (!token || !dc || !surveyId || !parentQid || !childQid) {
  console.error(
    "Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, SURVEY_ID, PARENT_QID, CHILD_QID."
  );
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

// Byte-for-byte match of what the Qualtrics UI writes when you configure
// display logic with "In Page" checked. The SDK's buildInPageDisplayLogic()
// will produce this shape; here we hand-build it to illustrate the schema.
function buildInPageDisplayLogic(parentQid: string, choiceKey: string, label: string) {
  return {
    "0": {
      "0": {
        QuestionID: parentQid,
        QuestionIsInLoop: "no",
        ChoiceLocator: `q://${parentQid}/SelectableChoice/${choiceKey}`,
        Operator: "Selected",
        QuestionIDFromLocator: parentQid,
        LeftOperand: "q://undefined/undefined",
        Type: "Expression",
        LogicType: "Question",
        Description: `<span class="ConjDesc">If</span> <span class="LeftOpDesc">${label}</span> <span class="OpDesc">Is Selected</span> `,
      },
      Type: "If",
    },
    Type: "BooleanExpression",
    inPage: true,
  };
}

async function main() {
  // Fetch the child question's current state.
  const getRes = await fetch(`${base}/survey-definitions/${surveyId}`, {
    headers: { "X-API-TOKEN": token! },
  });
  if (!getRes.ok) throw new Error(`fetch definition failed: ${getRes.status}`);
  const def: any = (await getRes.json()).result;
  const child = def.Questions[childQid!];
  if (!child) throw new Error(`child question ${childQid} not found on survey`);

  // Patch in the correct field. Note: do NOT send `DisplayLogic: null` — see REQ-2.31.
  const patched = {
    ...child,
    InPageDisplayLogic: buildInPageDisplayLogic(parentQid!, "1", "Yes"),
  };
  delete patched.DisplayLogic; // explicit omission, not null

  const putRes = await fetch(
    `${base}/survey-definitions/${surveyId}/questions/${childQid}`,
    {
      method: "PUT",
      headers: { "X-API-TOKEN": token!, "Content-Type": "application/json" },
      body: JSON.stringify(patched),
    }
  );
  if (!putRes.ok) {
    console.error(`PUT failed: ${putRes.status}`);
    console.error(await putRes.text());
    process.exit(5);
  }
  console.log(`InPageDisplayLogic installed on ${childQid}, gated on ${parentQid} == Yes.`);
  console.log(`Publish the survey and test in a fresh incognito window.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
