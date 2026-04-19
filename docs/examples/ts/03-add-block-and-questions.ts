/**
 * Example 03 — Add a block and two questions to an existing survey.
 *
 * Required user permissions: Access API, Edit Survey.
 * Required OAuth scopes:     manage:surveys (or manage:all).
 *
 * Failure symptom if missing: HTTP 403 with permission key `editSurveys`.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/03-add-block-and-questions.ts
 *
 * Run example 02 first to get a SURVEY_ID.
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;

if (!token || !dc || !surveyId) {
  console.error("Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, and SURVEY_ID.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3/survey-definitions/${surveyId}`;
const headers = { "X-API-TOKEN": token!, "Content-Type": "application/json" };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`${path} -> ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exit(5);
  }
  return (await res.json()) as T;
}

async function main() {
  const block = await post<{ result: { BlockID: string } }>("/blocks", {
    Type: "Standard",
    Description: "Applicant background",
  });
  const blockId = block.result.BlockID;
  console.log(`block: ${blockId}`);

  const q1 = await post<{ result: { QuestionID: string } }>(`/questions?blockId=${blockId}`, {
    QuestionText: "What is your institutional affiliation?",
    DataExportTag: "institution",
    QuestionType: "TE",
    Selector: "SL",
    Configuration: { QuestionDescriptionOption: "UseText" },
    Validation: { Settings: { ForceResponse: "ON", Type: "None" } },
  });
  console.log(`question 1: ${q1.result.QuestionID}`);

  const q2 = await post<{ result: { QuestionID: string } }>(`/questions?blockId=${blockId}`, {
    QuestionText: "Which category best describes your work?",
    DataExportTag: "category",
    QuestionType: "MC",
    Selector: "SAVR",
    SubSelector: "TX",
    Choices: {
      "1": { Display: "Academic research" },
      "2": { Display: "Industry R&D" },
      "3": { Display: "Government / nonprofit" },
    },
    ChoiceOrder: ["1", "2", "3"],
    Configuration: { QuestionDescriptionOption: "UseText" },
    Validation: { Settings: { ForceResponse: "ON", Type: "None" } },
  });
  console.log(`question 2: ${q2.result.QuestionID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
