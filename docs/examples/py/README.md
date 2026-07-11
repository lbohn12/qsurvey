# Python examples

Intentionally empty for v0. Per Spec 2's non-goal on language parity (`spec.md` line 140), the initial `qsurvey` SDK ships in TypeScript only. Python examples will land 1:1 with the TypeScript examples in [`../ts/`](../ts/) once the v0 TypeScript SDK is stable and the Python port begins.

If you need Python access to the Qualtrics API today, the [`qualtRics` R package](https://cran.r-project.org/web/packages/qualtRics/) and the unofficial `qualtrics-api` Python packages on PyPI are reasonable stopgaps. Note that most of them do not surface permission-level error diagnostics — if you hit a 403, consult [`../../permissions-and-scopes.md`](../../permissions-and-scopes.md) directly.
