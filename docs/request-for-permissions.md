# Request for permissions — copy-pasteable email

Send this to your Qualtrics brand administrator. Fill in the `{…}` placeholders. Delete any capability block you do not need.

---

**Subject:** Qualtrics API permissions request — {your name}

Hi {admin name},

I am using the `qsurvey` toolkit to script against Qualtrics for {short description of project, e.g., "a grant-application portal"}. Our existing API token lets me design surveys but rejects some of the automation endpoints we need. Would you be able to enable the user permissions below on my account so we can keep moving?

**My Qualtrics account:** {your email / your userId like `UR_abc123`}

**Our brand / data center:** {e.g., acme / iad1}

**Permissions I need enabled** (Admin → Users → my account → Permissions):

- [ ] **Access API** — prerequisite for everything.
- [ ] **Create Surveys** — to create new surveys programmatically.
- [ ] **Edit Survey** — to add and modify blocks, questions, and flow.
- [ ] **Activate Survey** — to publish surveys via the API.
- [ ] **View Response Data** — to export submitted responses.
- [ ] **Download Response Data** — to complete response exports (this is a separate checkbox from View).
- [ ] **Distribute Surveys** — to send email distributions and reminders.
- [ ] **Manage Workflows Across Projects** — to create, read, and manage workflows (actions/events/tasks) via the `/workflows` API. *This is the permission most commonly missing on enterprise tokens.*
- [ ] **Access XM Directory** — to read the contact directory.
- [ ] **Edit XM Directory** — to add contacts and create mailing lists.

**If our brand uses divisions:** please confirm that my user's division has the default XM Directory assigned to it under **Admin → Divisions → {division} → Directories**. A user permission on its own is not sufficient when the division does not have access.

**If our brand uses OAuth clients rather than personal API tokens:** please ensure the client I am using has these scopes (space-separated in the client configuration):

```
manage:all
```

(The fine-grained scopes like `read:surveys`, `manage:surveys`, `read:workflows`, `manage:workflows`, `read:directory_contacts`, `manage:directory_contacts` are the Qualtrics-recommended minimums, but several of them return `insufficient_scope` on endpoints the docs say they should cover. `manage:all` is the only scope that reliably unblocks the whole API surface. I am happy to switch to narrower scopes if/when Qualtrics fixes that gap.)

**Why I am asking for these specifically:** the tool I am using (`qsurvey`, an open-source CLI/SDK layer over the Qualtrics API) documents per-endpoint requirements at {link to `docs/permissions-and-scopes.md` once this repo is public}. The checkboxes above are the exact set required for our project scope.

Thank you,

{your name}

---

## Notes for the researcher sending this

- **Trim the list.** If you only need survey design (no workflows, no response export, no directory), delete those bullets. Shorter asks get turned around faster.
- **Cite the doc link** in the body if the repo is public. Admins answering a flood of tickets respond better when the request links to authoritative reference material.
- **Expect a delay.** At large enterprises, these requests sometimes route through a ticketing system and take days. If you are blocked, ask for the minimum unblocking permission (usually Access API + Create Surveys + Edit Survey + Activate Survey) first and request the rest in a second ticket.
- **Ask how to verify.** After the admin says "done", run [`examples/ts/01-auth-and-whoami.ts`](./examples/ts/01-auth-and-whoami.ts) and confirm the permissions block in the output matches. If you have the `qsurvey` CLI installed once it ships, `qsurvey doctor` (specified in [`runtime-scope-checks.md`](./runtime-scope-checks.md)) runs the same check in one command.
