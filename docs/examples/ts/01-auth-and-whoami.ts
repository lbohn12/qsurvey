/**
 * Example 01 — Authenticate and identify yourself.
 *
 * This is the smoke test. If this does not run, nothing else in this
 * example set will. GET /whoami is the one endpoint that requires no
 * permission beyond a valid token, so it is the right first call.
 *
 * Required user permissions: none (any valid token works).
 * Required OAuth scopes:     none.
 *
 * Run:
 *   QUALTRICS_API_TOKEN=... QUALTRICS_DATA_CENTER=iad1 \
 *     npx tsx docs/examples/ts/01-auth-and-whoami.ts
 */

const token = process.env.QUALTRICS_API_TOKEN;
const dc = process.env.QUALTRICS_DATA_CENTER;

if (!token || !dc) {
  console.error("Set QUALTRICS_API_TOKEN and QUALTRICS_DATA_CENTER in your env.");
  console.error("See docs/authentication.md for how to obtain each.");
  process.exit(2);
}

const base = `https://${dc}.qualtrics.com/API/v3`;

async function main() {
  const res = await fetch(`${base}/whoami`, {
    headers: { "X-API-TOKEN": token! },
  });

  if (!res.ok) {
    console.error(`whoami failed: ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exit(5);
  }

  const body = (await res.json()) as {
    result: {
      userId: string;
      userName: string;
      brandId: string;
      datacenter: string;
      permissions?: Record<string, Record<string, "true" | "false">>;
    };
  };

  const { userId, userName, brandId, datacenter, permissions } = body.result;
  console.log(`user:       ${userName} (${userId})`);
  console.log(`brand:      ${brandId}`);
  console.log(`datacenter: ${datacenter}`);

  // Print a compact permissions capability summary.
  if (permissions) {
    const flatten = Object.entries(permissions).flatMap(([group, perms]) =>
      Object.entries(perms).map(([k, v]) => [`${group}.${k}`, v === "true"] as const),
    );
    const enabled = flatten.filter(([, v]) => v).map(([k]) => k);
    console.log(`permissions enabled (${enabled.length}):`);
    for (const k of enabled.sort()) console.log(`  ${k}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
