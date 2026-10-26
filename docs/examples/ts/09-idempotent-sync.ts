/**
 * Example 09 — Idempotent sync: update questions in place without destroying flow nodes.
 *
 * Demonstrates REQ-2.11, REQ-2.34 (preserve unowned flow nodes), and REQ-2.35 (verify).
 *
 * The core pattern:
 *   1. Match live questions to schema by DataExportTag (QIDs stay stable).
 *   2. Preserve flow nodes the schema doesn't claim (e.g., manually-added
 *      EmbeddedData nodes that drive Modern Workflows).
 *   3. Run verify after PUT to catch Qualtrics' intermittent ForceResponse drops
 *      (this guide).
 *
 * This is a sketch; the real SDK will abstract this into `sdk.sync(schema)`.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/09-idempotent-sync.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;

if (!token || !dc || !surveyId) {
  console.error("Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, SURVEY_ID.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

// A tiny schema for demo purposes. In practice this comes from the SDK's
// declarative schema objects (REQ-2.7).
const schema = {
  questions: [
    {
      tag: "respondent_name",
      text: "Your name",
      type: "TE",
      selector: "SL",
      required: true,
    },
  ],
};

async function main() {
  // 1. Fetch the current definition.
  const defRes = await fetch(`${base}/survey-definitions/${surveyId}`, {
    headers: { "X-API-TOKEN": token! },
  });
  const def: any = (await defRes.json()).result;

  // 2. Build a tag → QID lookup.
  const tagToQid: Record<string, string> = {};
  for (const [qid, q] of Object.entries<any>(def.Questions)) {
    if (q.DataExportTag) tagToQid[q.DataExportTag] = qid;
  }

  // 3. Update each schema question in place, preserving QIDs.
  for (const spec of schema.questions) {
    const qid = tagToQid[spec.tag];
    if (!qid) {
      console.log(`TODO: create missing question ${spec.tag}`);
      continue;
    }
    const live = def.Questions[qid];
    const payload = {
      ...live,
      QuestionText: spec.text,
      QuestionType: spec.type,
      Selector: spec.selector,
      Validation: {
        ...live.Validation,
        Settings: {
          ...live.Validation?.Settings,
          ForceResponse: spec.required ? "ON" : "OFF",
          Type: "None",
        },
      },
    };
    const putRes = await fetch(
      `${base}/survey-definitions/${surveyId}/questions/${qid}`,
      {
        method: "PUT",
        headers: { "X-API-TOKEN": token!, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!putRes.ok) {
      console.error(`sync of ${spec.tag} failed: ${putRes.status}`);
      console.error(await putRes.text());
      process.exit(5);
    }
    console.log(`synced ${spec.tag} (${qid})`);
  }

  // 4. Verify: re-fetch and confirm ForceResponse didn't drop (this guide).
  const verifyRes = await fetch(`${base}/survey-definitions/${surveyId}`, {
    headers: { "X-API-TOKEN": token! },
  });
  const verify: any = (await verifyRes.json()).result;
  for (const spec of schema.questions) {
    const qid = tagToQid[spec.tag];
    const expected = spec.required ? "ON" : "OFF";
    const got = verify.Questions[qid]?.Validation?.Settings?.ForceResponse;
    if (got !== expected) {
      console.warn(
        `drift on ${spec.tag}: ForceResponse expected ${expected}, got ${got ?? "(missing)"}`
      );
    }
  }
  console.log("verify complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
