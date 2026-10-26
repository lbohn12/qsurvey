# Directory (XM Directory)

Qualtrics' XM Directory is the contact database that sits behind mailing-list distributions, CX/EX transactions, and contact-scoped workflows. For a public intake survey, the directory can provide mailing lists and contact-specific links.

**Prerequisites:** Access API + **Access XM Directory** for reads, **Edit XM Directory** for writes. Brand-admin operations additionally need **Manage Directories**. See [`permissions-and-scopes.md`](./permissions-and-scopes.md#directory-xm-directory).

## Concepts

| Concept | What it is |
| --- | --- |
| **Directory** | The top-level contact store. One per brand by default; enterprise tenants often have one per division. Has an ID like `POOL_…`. |
| **Contact** | An individual person with email, name, phone, embedded data, language, etc. Has an ID like `CID_…`. |
| **Mailing list** | A named subset of contacts within a directory. Has an ID like `CG_…` or `ML_…` depending on brand vintage. |
| **Transaction** | A timestamped event attached to a contact (CX/EX). Rarely used by technical users; documented for completeness. |
| **Sample** | A selection of contacts drawn from a directory. Research Core only; out of scope for qsurvey v0. |

## Discover your directory

```http
GET /API/v3/directories
X-API-TOKEN: {token}
```

Most brands return exactly one element. If you get multiple, the one you want is usually named "Global" or "Default" or has `isDefault: true`.

## List contacts

```http
GET /API/v3/directories/{directoryId}/contacts?pageSize=100
X-API-TOKEN: {token}
```

Response has a `contacts` array and a `nextPage` token. Contacts have this shape:

```json
{
  "contactId": "CID_abc",
  "firstName": "Alex",
  "lastName": "Example",
  "email": "alex@example.org",
  "phone": null,
  "language": "EN",
  "extRef": "respondent-117",
  "embeddedData": { "organization": "Example Organization", "group": "sample" },
  "unsubscribed": false
}
```

## Create a contact

```http
POST /API/v3/directories/{directoryId}/contacts
Content-Type: application/json
X-API-TOKEN: {token}

{
  "firstName": "Jordan",
  "lastName": "Rivera",
  "email": "jordan@example.org",
  "extRef": "respondent-117",
  "embeddedData": { "organization": "Example Organization" }
}
```

`extRef` is your external reference — any string. Use it to tie a Qualtrics contact back to an ID in your own system. If you add the same `extRef` twice, Qualtrics will usually deduplicate (if Automatic Deduplication / Identity Resolution is enabled on the directory).

## Update a contact

```http
PUT /API/v3/directories/{directoryId}/contacts/{contactId}
Content-Type: application/json
X-API-TOKEN: {token}

{ "embeddedData": { "reviewerAssigned": "reviewer@example.org" } }
```

PUT is a merge, not a replace — fields you omit are left unchanged. The exception is `embeddedData`: the keys you provide are merged with existing keys, but setting a key to `null` removes it.

## Create a mailing list

```http
POST /API/v3/directories/{directoryId}/mailinglists
Content-Type: application/json
X-API-TOKEN: {token}

{ "name": "Example Contact List", "ownerId": "UR_your_user_id" }
```

## Add a contact to a mailing list

```http
POST /API/v3/directories/{directoryId}/mailinglists/{mailingListId}/contacts
Content-Type: application/json
X-API-TOKEN: {token}

{ "contactId": "CID_abc" }
```

Or bulk-add by POSTing an array of `{ contactId }` objects.

## Transactions (briefly)

Transactions let you record "this contact did X at time T" and then trigger a transaction-scoped survey. Out of scope for qsurvey v0 because the configuration is brand-specific and has non-trivial prerequisites on the admin side. Documented here only so the SDK's `directory.transactions` namespace (if it ships) does not seem arbitrary.

## Users and groups

These are administrative, not directory-proper, but they live in the same permission area in this docs set because the same brand-admin-level permissions gate them.

### `GET /whoami`

```http
GET /API/v3/whoami
X-API-TOKEN: {token}
```

Returns the current user, including their `permissions` object — the effective union of user/group/division permissions. This is the endpoint [`runtime-scope-checks.md`](./runtime-scope-checks.md) specifies the SDK will call at startup to cache capabilities. **No permission is required to call `/whoami`**, which makes it the right place to land when diagnosing a token.

### List users

```http
GET /API/v3/users
X-API-TOKEN: {token}
```

Requires **View Users**. Brand-admin only in most tenants.

### List groups

```http
GET /API/v3/groups
X-API-TOKEN: {token}
```

Requires **Manage Groups**. Brand-admin only.

## Division-scoped directory access

Large enterprises scope directory access at the division level: your user permission may say "Access XM Directory" is on, but if your division does not have the directory assigned to it, you still 403. The admin-UI path for this is **Admin → Divisions → [division] → Directories**. Include this detail in the email to your brand admin (see [`request-for-permissions.md`](./request-for-permissions.md)).

## Example

[`examples/ts/07-directory-contacts.ts`](./examples/ts/07-directory-contacts.ts) demonstrates discover directory → create mailing list → add a contact → list contacts.

## See also

- [`permissions-and-scopes.md`](./permissions-and-scopes.md#directory-xm-directory)
- [`distributions.md`](./distributions.md) — mailing lists here feed distributions there.
- [`workflows.md`](./workflows.md) — `directory.contact.added` is a valid event type.
