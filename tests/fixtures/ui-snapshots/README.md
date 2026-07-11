# ui-snapshots/

Canonical question-payload JSON files, captured from Qualtrics UI-created questions via `GET /survey-definitions/{id}` and committed here as test fixtures.

See `../README.md` for the capture procedure and the 10 baseline fixtures needed (REQ-4.1).

**Status:** initial fixtures have not been captured yet; contributors with a Qualtrics dev account should follow the capture steps in `../README.md` and commit the resulting files here.

## Naming convention

`<type>-<selector>[-<variant>].<year>-<month>.json`

Examples:
- `mc-savr.2026-04.json` — MC/SAVR, Yes/No choices, captured April 2026
- `te-sl-with-inpage-display-logic.2026-04.json` — TE/SL child with InPageDisplayLogic gated on an MC parent
- `fileupload.2026-04.json` — FileUpload question with `Language: []`

The dated suffix makes it easy to audit which fixtures are recent vs stale when Qualtrics releases platform updates.
