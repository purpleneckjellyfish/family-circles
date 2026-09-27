import { signRequest } from "@/lib/federation/http-signature";

export async function deliverActivity(opts: {
  inboxUrl: string;
  activity: Record<string, unknown>;
  privateKeyPem: string;
  keyId: string;
}) {
  const body = JSON.stringify(opts.activity);
  const { headers } = signRequest({
    method: "POST",
    url: opts.inboxUrl,
    body,
    privateKeyPem: opts.privateKeyPem,
    keyId: opts.keyId,
  });

  const res = await fetch(opts.inboxUrl, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });

  if (!res.ok && res.status !== 202) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Delivery to ${opts.inboxUrl} failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return res.status;
}

export async function fetchJson(url: string, accept = "application/activity+json") {
  const res = await fetch(url, {
    headers: {
      Accept: `${accept}, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/json`,
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Fetch ${url} failed (${res.status})`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}
