/**
 * Example 04 — Activate a survey and print the anonymous link.
 *
 * Required user permissions: Access API, Activate Survey.
 * Required OAuth scopes:     manage:surveys (or manage:all).
 *
 * Failure symptom if missing: HTTP 403 with permission key `activateSurveys`.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/04-activate-and-get-link.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;

if (!token || !dc || !surveyId) {
  console.error("Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, and SURVEY_ID.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

async function main() {
  // Activation: POST to /surveys/{id} with isActive: true.
  const activate = await fetch(`${base}/surveys/${surveyId}`, {
    method: "POST",
    headers: { "X-API-TOKEN": token!, "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: true }),
  });
  if (!activate.ok) {
    console.error(`activate failed: ${activate.status}`);
    console.error(await activate.text());
    process.exit(5);
  }
  console.log(`activated: ${surveyId}`);

  // Anonymous link: constructed URL. Always works once the survey is active.
  const link = `https://${dc}.qualtrics.com/jfe/form/${surveyId}`;
  console.log(`anonymous link: ${link}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
