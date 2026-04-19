/**
 * ui-parity.test.ts — Spec 4 fixture harness (stub).
 *
 * Full implementation ships with the SDK v0. This stub exists so:
 *   1. The test-runner config knows where to look.
 *   2. The file itself is the obvious place for a contributor to start.
 *   3. Writing a real test is a small, scoped contribution.
 *
 * The real implementation should:
 *   - Load each fixture from ./fixtures/ui-snapshots/*.json
 *   - Invoke the corresponding SDK builder (buildQuestionPayload, buildInPageDisplayLogic, etc.)
 *   - Diff the output against the fixture, field-by-field
 *   - Respect the classification in ./fixtures/field-classification.json
 *   - Produce an error message that names the diverging field and links to docs/gotchas.md
 *
 * See tests/fixtures/README.md for the full harness design.
 * See spec.md Spec 4 (REQ-4.1 through REQ-4.6) for requirements.
 */

// TODO(v0): replace with real fixture-diff implementation.
describe.skip("UI-parity fixture harness — stub", () => {
  it("is a placeholder until the SDK ships", () => {
    // No assertions yet. See tests/fixtures/README.md for the design.
  });
});
