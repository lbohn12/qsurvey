# Display logic — `InPageDisplayLogic` vs `DisplayLogic`

**One-line:** Qualtrics stores display logic in two separate fields. The editor reads both. The runtime reads only one. Writing to the wrong one is a silent-failure bug. Always write in-page logic to `InPageDisplayLogic`.

**Prerequisites:** Edit Survey permission. See [`permissions-and-scopes.md`](./permissions-and-scopes.md#survey-platform--surveys-blocks-questions-flow).

## Concepts

| Field | When it fires | Editor behavior |
| --- | --- | --- |
| `DisplayLogic` | At page transitions. Respondent must click Next; conditional questions appear on the next page. | Editor shows any rule stored here. |
| `InPageDisplayLogic` | In real time as the respondent selects answers. Used when the "In Page" toggle is checked in the editor. | Editor also shows any rule stored here. The editor does not distinguish which field a rule came from. |

**This is the trap:** the Qualtrics editor displays display-logic rules from either field as if they're the same. You can configure a rule via the editor with "In Page" checked, see the rule render correctly in the editor, and have that rule stored in the wrong field via an earlier API push — and the editor won't warn you. The respondent runtime is strict and reads only the field matching the mode the question is configured for.

## The schema `InPageDisplayLogic` actually needs

The UI-produced `InPageDisplayLogic` structure is what the `qsurvey` SDK must match. Byte-for-byte, what Qualtrics writes when you configure "If Yes is Selected" with In Page checked:

```json
{
  "InPageDisplayLogic": {
    "0": {
      "0": {
        "QuestionID": "QID385",
        "QuestionIsInLoop": "no",
        "ChoiceLocator": "q://QID385/SelectableChoice/1",
        "Operator": "Selected",
        "QuestionIDFromLocator": "QID385",
        "LeftOperand": "q://undefined/undefined",
        "Type": "Expression",
        "LogicType": "Question",
        "Description": "<span class=\"ConjDesc\">If</span> <span class=\"LeftOpDesc\">Yes</span> <span class=\"OpDesc\">Is Selected</span> "
      },
      "Type": "If"
    },
    "Type": "BooleanExpression",
    "inPage": true
  }
}
```

Fields the SDK must include that are easy to miss:

- **`QuestionIDFromLocator`** — duplicate of `QuestionID`. Appears redundant; the runtime uses it. Omitting it is the suspected cause of some silent non-firing.
- **`LeftOperand: "q://undefined/undefined"`** — a literal placeholder string. Qualtrics computes the real operand at runtime; this field is just "reserve space for it."
- **`Description`** with three CSS-classed spans — `<span class="ConjDesc">If</span>`, `<span class="LeftOpDesc">Yes</span>`, `<span class="OpDesc">Is Selected</span>`. The editor uses these classes for styling. Omitting them may cause display but not runtime issues; include them to match UI-saved parity.
- **`inPage: true`** — at the top level of the `BooleanExpression`, not inside the `If`. This flag is the one thing the SDK has been setting correctly all along; the bug was writing to the wrong parent field.

## What NOT to do

**Don't write to `DisplayLogic` and set `inPage: true` on it.** This is the original bug. The editor will show the rule correctly but no In Page rendering will happen at runtime.

**Don't send `{"DisplayLogic": null}` to clear a rule.** Qualtrics 400s with `"Must validate one and only one schema (oneOf)"`. Omit the key from the payload instead.

**Don't rely on visual editor inspection to confirm a rule will fire.** The editor is forgiving; the runtime isn't. Fetch the question JSON and check which field the rule is in.

## Multi-condition rules (AND / OR)

Qualtrics uses `Conjuction` (their typo, preserved) on the 2nd and subsequent conditions. Example — show when SUBG is selected AND EYC is selected:

```json
"InPageDisplayLogic": {
  "0": {
    "0": {
      "QuestionID": "QID389",
      "ChoiceLocator": "q://QID389/SelectableChoice/1",
      "Operator": "Selected",
      "QuestionIDFromLocator": "QID389",
      "LeftOperand": "q://undefined/undefined",
      "Type": "Expression",
      "LogicType": "Question",
      "QuestionIsInLoop": "no",
      "Description": "<span class=\"ConjDesc\">If</span> <span class=\"LeftOpDesc\">SUBG</span> <span class=\"OpDesc\">Is Selected</span> "
    },
    "1": {
      "QuestionID": "QID389",
      "ChoiceLocator": "q://QID389/SelectableChoice/2",
      "Operator": "Selected",
      "QuestionIDFromLocator": "QID389",
      "LeftOperand": "q://undefined/undefined",
      "Type": "Expression",
      "LogicType": "Question",
      "QuestionIsInLoop": "no",
      "Description": "<span class=\"ConjDesc\">And</span> <span class=\"LeftOpDesc\">EYC</span> <span class=\"OpDesc\">Is Selected</span> ",
      "Conjuction": "And"
    },
    "Type": "If"
  },
  "Type": "BooleanExpression",
  "inPage": true
}
```

Change `Conjuction` to `"Or"` for OR logic. Note: the schema expresses boolean logic as a flat sequence, not a tree. `(A AND B) OR C` and `A AND (B OR C)` are not straightforwardly expressible — precedence is left-to-right. For complex expressions, use multiple flow-level Branch elements instead of question-level display logic.

## SDK surface

Per [`spec.md`](../spec.md) REQ-2.28 through REQ-2.31:

```ts
import { buildInPageDisplayLogic } from "qsurvey";

const logic = buildInPageDisplayLogic({
  when: { questionId: "QID385", choiceKey: "1", label: "Yes" },
  conjunctions: [],  // empty for single-condition
});

// Patch onto an existing question:
await sdk.questions.update(surveyId, "QID386", {
  ...existingQuestion,
  InPageDisplayLogic: logic,
  DisplayLogic: undefined,  // omit from payload; see REQ-2.31
});
```

See [`examples/ts/08-display-logic-inpage.ts`](./examples/ts/08-display-logic-inpage.ts) for the full round trip — create parent + child, wire up logic, verify via API fetch that `InPageDisplayLogic` matches a UI-saved fixture.

## Fixture-harness coverage

The [UI-parity fixture harness](../spec.md#spec-4--ui-parity-fixture-harness-cross-cutting-applies-to-sdk) (`tests/fixtures/ui-snapshots/te-sl-with-inpage-display-logic.json` and similar) enforces that `buildInPageDisplayLogic` produces output indistinguishable from a UI-saved example. CI fails on any runtime-critical-field drift.

## Debugging a rule that doesn't fire

When display logic looks right but the follow-up doesn't render at runtime:

1. **Fetch the question JSON via `GET /survey-definitions/{id}`.** Check: is the rule in `InPageDisplayLogic` (correct) or `DisplayLogic` (wrong)?
2. **Confirm `inPage: true` at the top of the `BooleanExpression`.**
3. **Confirm `QuestionIDFromLocator` and `LeftOperand: "q://undefined/undefined"` are both present on each condition.**
4. **Confirm the `ChoiceLocator` references an existing choice key.** `q://QID385/SelectableChoice/1` must correspond to a real choice `1` in the parent's `Choices` object.
5. **Confirm the parent question has `ChoiceOrder` set.** Missing `ChoiceOrder` is suspected to cause some runtime resolution issues. See [`choice-fields.md`](./choice-fields.md).
6. **Republish.** Draft-vs-published gets everyone eventually.
7. **Test in a fresh incognito window.** Browser and CDN caches linger.

If all of the above pass and the follow-up still doesn't render, capture a UI-saved reference (open the editor, toggle In Page off then on, save, fetch the question JSON) and diff against what the SDK produced. Any divergence is the next lead.

## References

- `spec.md` REQ-2.28, REQ-2.29, REQ-2.30, REQ-2.31
- [`gotchas.md`](./gotchas.md#inpagedisplaylogic-is-a-separate-field-from-displaylogic)
- CSSA `LESSONS.md` #13 — the post-mortem
- [Qualtrics API docs](https://api.qualtrics.com/) — official reference (does not document the two-field model)
