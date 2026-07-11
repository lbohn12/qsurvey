# Embedded JavaScript (planned)

> **Status: stub.** Placeholder for a planned reference on Qualtrics custom/embedded
> JavaScript. Not written yet.

Qualtrics lets you attach custom JavaScript to a question through the question editor.
It runs inside the survey's `Qualtrics.SurveyEngine` lifecycle
(`addOnload` / `addOnReady` / `addOnUnload`). This is a major advanced surface — custom
validation, dynamic show/hide, embedded-data reads and writes, DOM work — and it carries
its own silent-failure footguns (handler timing, jQuery availability, embedded-data
timing, preview-vs-live and mobile differences).

Planned coverage:

- The `Qualtrics.SurveyEngine` lifecycle handlers and when each one is safe to use.
- Reading and writing embedded data from question JavaScript.
- Common footguns, documented from real use in the same symptom / cause / remediation
  format as [`gotchas.md`](./gotchas.md).

Until this page is written, treat embedded JavaScript as out of scope for the toolkit's
guarantees.
