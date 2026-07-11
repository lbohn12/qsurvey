/**
 * Example 11 — Build a Qualtrics Q_R resume URL without the destructive Q_R_DEL=1.
 *
 * Demonstrates REQ-2.39 from spec.md. See docs/gotchas.md#q_r_del1-wipes-completed-responses
 * and the internal post-mortem for the background — why this helper exists and why
 * appending Q_R_DEL=1 to applicant-facing URLs is never correct.
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
   * resolve — see the internal post-mortem.
   */
  responseIdField?: string;

  /**
   * DANGEROUS. Only set to true for resume URLs that are guaranteed to
   * be used by respondents whose response is NOT yet complete — this
   * parameter deletes the referenced response and creates a new one,
   * which silently wipes data from applicants who have already submitted.
   *
   * Default: false. If you're tempted to set this to true, read
   * docs/gotchas.md#q_r_del1-wipes-completed-responses first.
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
  console.log("  - resumes the applicant's in-progress response without data loss");
  console.log("  - sends them to the End-of-Survey page if their response is already submitted");
  console.log("  - never wipes a completed submission");

  // Deliberate contrast. Use only if you understand what you're turning on.
  // const destructive = buildResumeUrl({
  //   dataCenter: "iad1",
  //   surveyId: "SV_abc123",
  //   deleteExistingResponse: true,
  // });
}

main();
