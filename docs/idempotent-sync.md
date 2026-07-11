# Idempotent sync — update without destroying

The `qsurvey` SDK's `sync` operation takes a declarative schema and reconciles it against a live Qualtrics survey, updating only what differs. This doc explains what that means in practice, what "differ" means across Qualtrics' inconsistent PUT endpoints, and how the sync avoids destroying the parts of a survey that were edited manually in the UI.

**Prerequisites:** Edit Survey on the target survey. See [`permissions-and-scopes.md`](./permissions-and-scopes.md).

## The principle

**Never run a full re-seed on a live survey with workflows.** Workflows reference questions by `QID` (`QID5`, `QID386`, etc.), not by `DataExportTag`. A re-seed deletes all questions and creates new ones with fresh QIDs. Every workflow that references the old QIDs silently breaks.

Symptom seen on the origin project: after a `--clean` re-seed, workflows showed "Condition: Evaluated False" with `B0_EMAIL → undefined`, actual value `""`. The question existed, but under a new QID the workflow didn't know about.

`qsurvey sync` matches existing questions by `DataExportTag` and updates them in place, preserving QIDs. This is REQ-2.11 in `spec.md`.

## What sync does, in order

Given a schema and a target survey ID:

1. **Fetch the live definition** via `GET /survey-definitions/{id}`.
2. **Index live content** by `DataExportTag` → `QID`, and by block description → `BlockID`.
3. **Reconcile blocks:** for each block in the schema that's missing from the live survey, create it. Do not delete blocks that exist live but are absent from the schema (they may have been added manually — require explicit caller action to delete).
4. **Reconcile questions:** for each question in the schema, if a question with the same `DataExportTag` exists live, `PUT` its payload (preserving QID). If not, create it under the appropriate block.
5. **Reconcile flow:** fetch the current flow, compute a minimal diff, `PUT` the merged flow. Critically: preserve flow nodes the schema doesn't mention (EmbeddedData nodes, Branch elements, etc.) — see next section.
6. **Reconcile survey options:** fetch current options, patch in the schema's overrides, `PUT`. Never send `null` for fields the schema doesn't touch.
7. **Publish** (REQ from `spec.md` — make the draft visible to respondents).
8. **Verify** — fetch the now-live definition and diff against the schema. Report any drift. This catches the intermittent "PUT returned 200 but Qualtrics dropped a field" failure mode (the internal post-mortem).

## Preserving manually-added flow nodes

The canonical example: the survey flow contains an `EmbeddedData` node that sets `respondent_name`, `respondent_email`, and `response_id` from question answers. This node was added in the Qualtrics UI (Modern Workflows are managed in the UI, and the fields these drive are consumed by workflows). If the SDK's sync replaces the flow wholesale using only the schema-described structure, this node is wiped and every workflow breaks.

**Rule:** sync preserves any flow node whose `Type` the schema doesn't claim ownership of. Specifically:

- Preserve `EmbeddedData` flow nodes unless the schema explicitly declares ownership via a dedicated field.
- Preserve `Branch` flow nodes unless the schema includes a matching `Branch` by description or purpose.
- Preserve `WebService` nodes unconditionally — the SDK doesn't model them in v0.
- Preserve `Authenticator` nodes unconditionally — same reason.

The merge logic is: reorder schema-described elements into their expected positions, splice preserved elements into the sequence at their original indices (or adjacent to the blocks they logically follow), and emit the resulting flow.

This is REQ-2.34 in `spec.md`. The fixture harness (Spec 4) includes a flow-merge test case that asserts an EmbeddedData node isn't wiped after a sync where the schema didn't mention it.

## Qualtrics' PUT endpoints behave inconsistently

Not all Qualtrics PUT endpoints have the same semantics. Some are merge, some are replace.

| Endpoint | Behavior |
| --- | --- |
| `PUT /survey-definitions/{id}/questions/{qid}` | **Replace** on most fields, but sometimes drops fields like `ForceResponse` even when supplied (the internal post-mortem). Always verify after. |
| `PUT /survey-definitions/{id}/blocks/{bid}` | Replace. Must supply all `BlockElements` in order. |
| `PUT /survey-definitions/{id}/flow` | Replace the entire flow tree. The caller is responsible for merging preserved elements in. |
| `PUT /survey-definitions/{id}/options` | Merge-like: unprovided fields retain their previous values, but `null` triggers `oneOf` validation errors on some fields. |

The SDK's sync normalizes across these by:

- For `questions` and `blocks`: always reading the current state, merging the schema's changes, and PUTting the full merged object.
- For `flow`: reading current, preserving unowned nodes (see previous section), and PUTting.
- For `options`: reading current, patching in schema overrides, and PUTting without nulls. If the schema tries to clear a field, omit it rather than sending null.

## Verify-after-update

Every sync run ends with a verify pass:

```ts
const diff = await sdk.verify(surveyId, schema);
if (diff.length > 0) {
  console.warn("Post-sync drift detected:", diff);
}
```

This is REQ-2.35. Common drift:

- `ForceResponse` dropped by Qualtrics on some updates (the internal post-mortem) — re-push fixes it.
- Display logic in wrong field (see [`display-logic.md`](./display-logic.md)) — indicates the SDK's builder is drifting from UI parity; the fixture harness should have caught this first.
- Survey options reverted (e.g., `BallotBoxStuffingPrevention` flipped off) — indicates someone edited in the UI; investigate.

## The `--clean` path, and when not to use it

`qsurvey from-pdf` and the SDK both offer a nuclear `--clean` option that deletes all questions and blocks before seeding. Use it only when:

- The target survey is brand-new.
- No workflows have been configured on the survey yet.
- No shared distributions reference specific QIDs.

The CLI refuses to run `--clean` on a survey with active workflows unless `--force` is also passed (REQ implicit in `spec.md` Spec 1 safety principles; see `runtime-scope-checks.md` for the detection logic).

## Diff output shape

`sdk.verify()` returns a typed diff:

```ts
type VerifyDiff = {
  changes: Change[];
  warnings: Warning[];
};

type Change =
  | { kind: "question-added"; tag: string; qid: string }
  | { kind: "question-changed"; tag: string; qid: string; field: string; live: unknown; schema: unknown }
  | { kind: "question-removed-from-live"; tag: string; qid: string; note: string }
  | { kind: "block-added"; description: string; bid: string }
  | { kind: "flow-node-inserted"; type: string; flowId: string }
  | { kind: "flow-node-preserved"; type: string; flowId: string; reason: string }
  | { kind: "option-changed"; field: string; live: unknown; schema: unknown };
```

Downstream tools (CI, the CLI's `--verify` flag, the branded portal's re-fetch loop) consume this shape.

## See also

- [`survey-platform.md`](./survey-platform.md) — the endpoints sync operates against
- [`choice-fields.md`](./choice-fields.md) — what sync preserves vs overwrites on question updates
- [`display-logic.md`](./display-logic.md) — why `InPageDisplayLogic` must be preserved even when the schema doesn't mention the rule
- [`gotchas.md`](./gotchas.md) — common drift causes
- the internal post-mortem (never --clean a live survey) and #14 (ForceResponse drift)
