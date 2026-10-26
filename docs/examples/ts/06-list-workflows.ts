/**
 * Example 06 — List workflows.
 *
 * Workflow API access depends on your Qualtrics brand and user permissions.
 * If this call returns HTTP 403, check the response and confirm the required
 * permission with your brand administrator.
 *
 * Likely user permission: Access API; one tenant also required Manage Workflows Across Projects.
 * Likely OAuth scope: read:workflows. Confirm both for your brand.
 *
 * Failure symptom if missing: HTTP 403 with permission key `manageWorkflows`.
 *
 * Run:
 *   QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/06-list-workflows.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;

if (!token || !dc) {
  console.error("Set QUALTRICS_API_TOKEN and QUALTRICS_DATA_CENTER.");
  process.exit(2);
}

async function main() {
  const res = await fetch(
    `https://${dc}.qualtrics.com/API/v3/workflows?includeTaskTypes=true`,
    { headers: { "X-API-TOKEN": token! } },
  );

  if (res.status === 403) {
    console.error("=========================================================");
    console.error("HTTP 403 on GET /workflows.");
    console.error("");
    console.error("Your token is missing 'Manage Workflows Across Projects'.");
    console.error("Copy docs/request-for-permissions.md, fill it in with your");
    console.error("user info, and send it to your Qualtrics brand admin.");
    console.error("=========================================================");
    console.error("");
    console.error("Raw response:");
    console.error(await res.text());
    process.exit(5);
  }
  if (!res.ok) {
    console.error(`list failed: ${res.status}`);
    console.error(await res.text());
    process.exit(5);
  }

  const body = (await res.json()) as {
    result: {
      elements: Array<{
        id: string;
        name: string;
        status: string;
        eventType?: string;
        surveyId?: string;
        taskTypes?: string[];
      }>;
    };
  };

  console.log(`${body.result.elements.length} workflow(s):`);
  for (const wf of body.result.elements) {
    const where = wf.surveyId ? `survey=${wf.surveyId}` : "brand-scoped";
    const tasks = wf.taskTypes?.join(", ") ?? "(unknown)";
    console.log(`  [${wf.status}] ${wf.id}  ${wf.name}  event=${wf.eventType ?? "?"}  ${where}  tasks=[${tasks}]`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
