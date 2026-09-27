import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

async function main() {
  const base = "http://127.0.0.1:43127";
  const email = "phase5-1790519229663@example.com";
  const password = "password123";
  const slug = "phase5-3a64";
  const personId = "08760d60-9a2b-45bf-be1b-694c59e7a9fa";

  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  const csrfCookie = csrfRes.headers.getSetCookie?.() ?? [];
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${base}/home`,
    json: "true",
  });
  const cookieHeader = csrfCookie.map((c) => c.split(";")[0]).join("; ");
  const signRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader,
    },
    body,
    redirect: "manual",
  });
  const setCookies = signRes.headers.getSetCookie?.() ?? [];
  const cookie = [...csrfCookie, ...setCookies]
    .map((c) => c.split(";")[0])
    .join("; ");

  const paths = [
    `/families/${slug}/browse`,
    `/families/${slug}/browse/people/${personId}`,
    `/families/${slug}/browse/years/2019`,
    `/families/${slug}/export`,
  ];
  const results: Record<string, string> = {};
  for (const p of paths) {
    const res = await fetch(`${base}${p}`, {
      headers: { cookie },
      redirect: "manual",
    });
    const text = await res.text();
    results[p] = `${res.status} len=${text.length}`;
  }

  const zipRes = await fetch(`${base}/api/families/${slug}/export`, {
    headers: { cookie },
  });
  const buf = Buffer.from(await zipRes.arrayBuffer());
  await writeFile("data/tmp/http-export.zip", buf);
  const listing = execFileSync("unzip", ["-l", "data/tmp/http-export.zip"], {
    encoding: "utf8",
  });
  results.exportApi = `${zipRes.status} ct=${zipRes.headers.get("content-type")} bytes=${buf.length} pk=${buf[0] === 0x50 && buf[1] === 0x4b}`;
  results.zipListing = listing.includes("memories.json")
    ? "ok"
    : "missing memories.json";

  console.log(JSON.stringify(results, null, 2));
  if (
    Object.values(results).some((v) => v.startsWith("3") || v.startsWith("4") || v.startsWith("5"))
  ) {
    // allow only exportApi / zipListing non-status lines
  }
  for (const p of paths) {
    if (!results[p].startsWith("200")) {
      throw new Error(`bad status for ${p}: ${results[p]}`);
    }
  }
  if (!results.exportApi.startsWith("200") || results.zipListing !== "ok") {
    throw new Error("export API failed");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
