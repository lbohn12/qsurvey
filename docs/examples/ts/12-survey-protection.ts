/**
 * Example 12 — Turn on "Prevent Multiple Submissions" via the survey-options API.
 *
 * Demonstrates REQ-2.36 from spec.md — the primary defense against the post-submit
 * resubmission bug seen on the origin project. This is cookie-based (same-browser only);
 * pair with the flow branch guard (example 10) for cross-device defense.
 *
 * See docs/survey-protection.md for the full lever-vs-threat-model matrix.
 *
 * Required user permissions: Access API, Edit Survey.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/12-survey-protection.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;

if (!token || !dc || !surveyId) {
  console.error("Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, SURVEY_ID.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

async function main() {
  // 1. Fetch current options. The options endpoint requires PUT to include all
  // mandatory fields, so we patch onto what's already there.
  const defRes = await fetch(`${base}/survey-definitions/${surveyId}`, {
    headers: { "X-API-TOKEN": token! },
  });
  const def: any = (await defRes.json()).result;
  const options = { ...def.SurveyOptions };

  // 2. Patch in the resubmission-prevention flags.
  //
  // Do NOT attempt to set SurveyLinkCompletedMessage as inline HTML here —
  // the options API rejects it with 400 "oneOf". That field requires a
  // message-library reference; until qsurvey libraries support ships
  // (REQ-2.37), configure it via the Qualtrics UI.
  options.BallotBoxStuffingPrevention = "true";
  options.BallotBoxStuffingPreventionBehavior = "DefaultMessage";

  // 3. PUT the full options object back.
  const putRes = await fetch(`${base}/survey-definitions/${surveyId}/options`, {
    method: "PUT",
    headers: { "X-API-TOKEN": token!, "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!putRes.ok) {
    console.error(`options PUT failed: ${putRes.status}`);
    console.error(await putRes.text());
    process.exit(5);
  }

  console.log("BallotBoxStuffingPrevention enabled with default message.");
  console.log("Threat coverage:");
  console.log("  ✅ Same browser, same window / fresh window");
  console.log("  ❌ Different browser, incognito, different device");
  console.log("For cross-device coverage, layer SurveyLinkCompletedMessage (UI only for now)");
  console.log("and a flow-level branch guard (see example 10).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
