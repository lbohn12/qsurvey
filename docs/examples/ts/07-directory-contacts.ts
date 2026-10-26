/**
 * Example 07 — Discover a directory, create a mailing list, add a contact.
 *
 * Required user permissions: Access API, Access XM Directory, Edit XM Directory.
 * Required OAuth scopes:     read:directories, manage:mailing_lists,
 *                             manage:directory_contacts (or manage:all).
 *
 * Failure symptoms if missing:
 *   - HTTP 403 on GET /directories -> Access XM Directory is off.
 *   - HTTP 403 on POST /mailinglists or /contacts -> Edit XM Directory is off.
 *   - Division-scoped 403: even with the user permission on, the directory
 *     may not be assigned to your division. Brand admin fix, not a user fix.
 *
 * Run:
 *   QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/07-directory-contacts.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;

if (!token || !dc) {
  console.error("Set QUALTRICS_API_TOKEN and QUALTRICS_DATA_CENTER.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;
const headers = { "X-API-TOKEN": token!, "Content-Type": "application/json" };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    console.error(`${res.url} -> ${res.status}`);
    console.error(await res.text());
    process.exit(5);
  }
  return (await res.json()) as T;
}

async function main() {
  // 1. Discover the default directory.
  const dirs = await json<{
    result: { elements: Array<{ directoryId: string; name: string; isDefault?: boolean }> };
  }>(await fetch(`${base}/directories`, { headers }));
  const directory =
    dirs.result.elements.find((d) => d.isDefault) ?? dirs.result.elements[0];
  if (!directory) {
    console.error("No directories visible to this token.");
    process.exit(5);
  }
  console.log(`directory: ${directory.directoryId} (${directory.name})`);

  // 2. Get /whoami to resolve the mailing-list owner.
  const me = await json<{ result: { userId: string } }>(
    await fetch(`${base}/whoami`, { headers }),
  );

  // 3. Create a mailing list.
  const ml = await json<{ result: { id: string } }>(
    await fetch(`${base}/directories/${directory.directoryId}/mailinglists`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: `qsurvey example ${Date.now()}`, ownerId: me.result.userId }),
    }),
  );
  console.log(`mailing list: ${ml.result.id}`);

  // 4. Add a contact to the directory.
  const contact = await json<{ result: { contactId: string } }>(
    await fetch(`${base}/directories/${directory.directoryId}/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        email: `ada+${Date.now()}@example.org`,
        extRef: `example-07-${Date.now()}`,
        embeddedData: { organization: "Example Organization" },
      }),
    }),
  );
  console.log(`contact: ${contact.result.contactId}`);

  // 5. Attach the contact to the mailing list.
  await json(
    await fetch(
      `${base}/directories/${directory.directoryId}/mailinglists/${ml.result.id}/contacts`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ contactId: contact.result.contactId }),
      },
    ),
  );
  console.log(`attached ${contact.result.contactId} -> ${ml.result.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
