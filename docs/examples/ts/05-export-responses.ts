/**
 * Example 05 — Export responses: start job, poll, download, unzip.
 *
 * Required user permissions: Access API, View Response Data, Download Response Data.
 * Required OAuth scopes:     read:survey_responses (or manage:all).
 *
 * Failure symptoms if missing:
 *   - HTTP 403 on POST  /export-responses           -> View Response Data is off.
 *   - HTTP 403 on GET   /export-responses/{id}/file -> Download Response Data is off.
 *
 * Usage:
 *   SURVEY_ID=SV_abc123 QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/05-export-responses.ts
 */

import { writeFileSync } from "node:fs";

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;
const surveyId = process.env.SURVEY_ID;

if (!token || !dc || !surveyId) {
  console.error("Set QUALTRICS_API_TOKEN, QUALTRICS_DATA_CENTER, and SURVEY_ID.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3/surveys/${surveyId}/export-responses`;
const headers = { "X-API-TOKEN": token!, "Content-Type": "application/json" };

async function main() {
  // Step 1: start the job.
  const start = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ format: "json", compress: true, useLabels: false }),
  });
  if (!start.ok) {
    console.error(`start failed: ${start.status}`);
    console.error(await start.text());
    process.exit(5);
  }
  const progressId = (await start.json() as { result: { progressId: string } }).result.progressId;
  console.log(`job started: ${progressId}`);

  // Step 2: poll. Backoff 1s -> 5s. Cap at 2 minutes.
  const deadline = Date.now() + 120_000;
  let fileId: string | null = null;
  let delay = 1000;
  while (Date.now() < deadline) {
    const poll = await fetch(`${base}/${progressId}`, { headers });
    if (!poll.ok) {
      console.error(`poll failed: ${poll.status}`);
      process.exit(5);
    }
    const body = (await poll.json()) as {
      result: { percentComplete: number; status: string; fileId?: string };
    };
    process.stdout.write(`\rprogress: ${body.result.percentComplete.toFixed(0)}% (${body.result.status})    `);
    if (body.result.status === "complete" && body.result.fileId) {
      fileId = body.result.fileId;
      process.stdout.write("\n");
      break;
    }
    if (body.result.status === "failed") {
      console.error("\nexport job failed server-side");
      process.exit(5);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 5000);
  }
  if (!fileId) {
    console.error("timed out after 2 minutes");
    process.exit(6);
  }

  // Step 3: download (zipped).
  const file = await fetch(`${base}/${fileId}/file`, { headers: { "X-API-TOKEN": token! } });
  if (!file.ok) {
    console.error(`download failed: ${file.status}`);
    console.error(await file.text());
    process.exit(5);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const path = `./responses-${surveyId}.zip`;
  writeFileSync(path, buf);
  console.log(`wrote ${buf.length} bytes to ${path}`);
  console.log(`unzip with: unzip ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
