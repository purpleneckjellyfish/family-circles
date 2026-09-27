import "dotenv/config";

async function main() {
  const base = process.env.APP_URL ?? "http://127.0.0.1:43127";
  const email = process.argv[2];
  const password = process.argv[3] ?? "password123";
  if (!email) throw new Error("usage: auth-login-test email [password]");

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
  const allCookies = [...csrfCookie, ...setCookies]
    .map((c) => c.split(";")[0])
    .join("; ");

  const sessionRes = await fetch(`${base}/api/auth/session`, {
    headers: { cookie: allCookies },
  });
  const session = await sessionRes.json();

  const homeRes = await fetch(`${base}/home`, {
    headers: { cookie: allCookies },
    redirect: "manual",
  });

  console.log(
    JSON.stringify(
      {
        signStatus: signRes.status,
        location: signRes.headers.get("location"),
        session,
        homeStatus: homeRes.status,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
