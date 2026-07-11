/**
 * Example 02 — Create an empty survey.
 *
 * Required user permissions: Access API, Create Surveys.
 * Required OAuth scopes:     manage:surveys (or manage:all).
 *
 * Failure symptom if missing: HTTP 403 with permission key `createSurveys`.
 *
 * Run:
 *   QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/02-create-survey.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;

if (!token || !dc) {
  console.error("Set QUALTRICS_API_TOKEN and QUALTRICS_DATA_CENTER in your env.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

async function main() {
  const res = await fetch(`${base}/survey-definitions`, {
    method: "POST",
    headers: {
      "X-API-TOKEN": token!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      SurveyName: "qsurvey example 02",
      Language: "EN",
      ProjectCategory: "CORE",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`create failed: ${res.status} ${res.statusText}`);
    console.error(body);
    // See docs/permissions-and-scopes.md#survey-platform if this was a 403.
    process.exit(5);
  }

  const body = (await res.json()) as { result: { SurveyID: string } };
  console.log(`created: ${body.result.SurveyID}`);
  console.log(`edit url: https://${dc}.qualtrics.com/Q/EditSection/Blocks?ContextSurveyID=${body.result.SurveyID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
