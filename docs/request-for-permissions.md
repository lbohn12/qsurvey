# Request for permissions — copy-pasteable email

Send this to your Qualtrics brand administrator. Fill in the `{…}` placeholders. Delete any capability block you do not need.

---

**Subject:** Qualtrics API permissions request — {your name}

Hi {admin name},

I am using the `qsurvey` documentation and examples to script against Qualtrics for {short description of use, e.g., "survey creation and response export"}. My API token can access some operations but rejects others. Would you confirm the minimum user permissions needed for the operations below and enable them on my account?

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

**If our brand uses OAuth clients rather than personal API tokens:** please confirm the minimum scopes for these operations with the current Qualtrics API documentation and configure the client accordingly. The scope below is only an observation from one tenant, not a universal requirement:

```
manage:all
```

(The scopes above are examples from the API documentation. In the author's tenant, some fine-grained scopes returned `insufficient_scope` on calls expected to allow them, while `manage:all` worked. Treat this as an observation from one configuration, not a universal Qualtrics rule; verify the minimum scope for your endpoint and brand.)

**Why I am asking for these specifically:** the `qsurvey` guide has best-effort permission notes at {link to `docs/permissions-and-scopes.md`}. Please confirm the current minimum requirements for our brand; the guide may not cover every endpoint or account configuration.

Thank you,

{your name}

---

## Notes for the Qualtrics user sending this

- **Trim the list.** If you only need survey design (no workflows, no response export, no directory), delete those bullets. Shorter asks get turned around faster.
- **Cite the doc link** in the body if the repo is public. Admins answering a flood of tickets respond better when the request links to authoritative reference material.
- **Expect a delay.** At large enterprises, these requests sometimes route through a ticketing system and take days. If you are blocked, ask for the minimum unblocking permission (usually Access API + Create Surveys + Edit Survey + Activate Survey) first and request the rest in a second ticket.
- **Ask how to verify.** After the admin says "done", use a read-only API call such as [`examples/ts/01-auth-and-whoami.ts`](./examples/ts/01-auth-and-whoami.ts), then check the endpoint documentation and the response from the specific operation you need.
