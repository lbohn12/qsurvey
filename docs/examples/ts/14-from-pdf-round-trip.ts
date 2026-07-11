/**
 * Example 14 — `qsurvey from-pdf` round trip (stub).
 *
 * Full implementation ships with Spec 1 CLI v0. This stub documents the
 * intended shape so contributors and LLM agents can see the command's
 * targeted interface before it exists.
 *
 * Intended flow:
 *   1. Parse the source PDF into an intermediate structured representation
 *      (REQ-1.2). Currently this is an LLM call — Claude by default (REQ-1.22).
 *   2. Build the qsurvey declarative schema from the representation.
 *   3. Call sdk.sync(surveyId, schema) or sdk.create(schema) to apply it.
 *   4. Run sdk.verify(surveyId, schema) and print any drift (REQ-1.24).
 *   5. Print the edit URL and anonymous preview link (REQ-1.4).
 *
 * Safe defaults enforced on every CLI-created survey:
 *   - BallotBoxStuffingPrevention: true (REQ-1.25)
 *   - Resume URLs emitted with no Q_R_DEL=1 (REQ-1.26)
 *   - InPageDisplayLogic correctness (REQ-2.28)
 *
 * Usage (intended, not yet implemented):
 *   qsurvey from-pdf ./program-rfa.pdf --verify
 */

console.log("Example 14 is a stub. See spec.md Spec 1 (REQ-1.x) for the design.");
console.log();
console.log("Implementation ships with the CLI v0. Before that:");
console.log("  - See example 09 for idempotent sync pattern.");
console.log("  - See example 13 for verify-drift pattern.");
console.log("  - See example 08 for display-logic correctness.");
console.log("  - See example 12 for survey-protection defaults.");
console.log("  - Combine them by hand for now; the CLI wraps them.");
