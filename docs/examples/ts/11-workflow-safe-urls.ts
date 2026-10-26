/**
 * Example 11 — Build a Qualtrics Q_R resume URL without Q_R_DEL=1 by default.
 *
 * Demonstrates REQ-2.39 from spec.md. See docs/gotchas.md#q_r_del1-replaces-the-original-response-when-a-retake-is-submitted
 * and this guide for the background — why this helper exists and why
 * Q_R_DEL=1 is only for intentional retake-and-replace flows.
 *
 * This is a pure function example; no network calls. Runs anywhere.
 *
 * Usage:
 *   npx tsx docs/examples/ts/11-workflow-safe-urls.ts
 */

type ResumeUrlOptions = {
  dataCenter: string;   // e.g., "iad1"
  surveyId: string;     // e.g., "SV_abc123"
  /**
   * Embedded-data field name that will hold the response ID at workflow
   * email render time. Default matches the canonical pattern where a flow
   * EmbeddedData node sets `response_id` from `${e://Field/ResponseID}`.
   * Using the built-in `ResponseID` directly in workflow emails does NOT
   * resolve — see this guide.
   */
  responseIdField?: string;

  /**
   * Only set to true when an intentional retake should replace the
   * referenced response after the respondent submits the retake.
   *
   * Default: false. If you're tempted to set this to true, read
   * docs/gotchas.md#q_r_del1-replaces-the-original-response-when-a-retake-is-submitted first.
   */
  deleteExistingResponse?: boolean;
};

export function buildResumeUrl(opts: ResumeUrlOptions): string {
  const {
    dataCenter,
    surveyId,
    responseIdField = "response_id",
    deleteExistingResponse = false,
  } = opts;

  const base = `https://${dataCenter}.qualtrics.com/jfe/form/${surveyId}`;
  const qr = `?Q_R=\${e://Field/${responseIdField}}`;

  if (deleteExistingResponse) {
    return `${base}${qr}&Q_R_DEL=1`;
  }
  return `${base}${qr}`;
}

function main() {
  const safe = buildResumeUrl({
    dataCenter: "iad1",
    surveyId: "SV_abc123",
  });
  console.log("safe URL (paste into workflow email body, then hyperlink in the editor):");
  console.log("  " + safe);
  console.log();
  console.log("This URL:");
  console.log("  - resumes the respondent's in-progress response without data loss");
  console.log("  - sends them to the End-of-Survey page if their response is already submitted");
  console.log("  - leaves Q_R_DEL=1 out unless replacement is intentional");

  // Deliberate contrast. Use only if you understand what you're turning on.
  // const destructive = buildResumeUrl({
  //   dataCenter: "iad1",
  //   surveyId: "SV_abc123",
  //   deleteExistingResponse: true,
  // });
}

main();
