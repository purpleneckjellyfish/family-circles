import { fetchJson } from "@/lib/federation/deliver";
import { federationOrigin } from "@/lib/federation/urls";

export type RemoteActor = {
  id: string;
  type: string;
  name: string;
  preferredUsername: string;
  summary: string | null;
  inbox: string;
  outbox: string;
  sharedInbox: string | null;
  publicKeyPem: string | null;
  allowFederatedComments: boolean;
  host: string;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function hostOf(url: string) {
  return new URL(url).host;
}

export function parseActorDocument(doc: Record<string, unknown>): RemoteActor {
  const id = asString(doc.id);
  if (!id) throw new Error("Actor document missing id");
  const inbox = asString(doc.inbox);
  const outbox = asString(doc.outbox);
  if (!inbox || !outbox) throw new Error("Actor missing inbox/outbox");

  const publicKey = doc.publicKey as Record<string, unknown> | undefined;
  const shared =
    asString((doc.endpoints as Record<string, unknown> | undefined)?.sharedInbox) ||
    asString(doc.sharedInbox);

  const username =
    asString(doc.preferredUsername) ||
    id.split("/").filter(Boolean).pop() ||
    "family";

  const allow =
    doc["fc:allowFederatedComments"] === false ||
    doc.allowFederatedComments === false
      ? false
      : true;

  return {
    id,
    type: asString(doc.type) || "Group",
    name: asString(doc.name) || username,
    preferredUsername: username,
    summary: asString(doc.summary),
    inbox,
    outbox,
    sharedInbox: shared,
    publicKeyPem: asString(publicKey?.publicKeyPem),
    allowFederatedComments: allow,
    host: hostOf(id),
  };
}

/**
 * Resolve a remote Family Circles family from:
 * - https://host/families/slug
 * - https://host/ap/families/slug
 * - acct:slug@host
 * - slug@host
 */
export async function discoverRemoteFamily(
  input: string,
): Promise<RemoteActor> {
  const raw = input.trim();
  if (!raw) throw new Error("Enter a family URL or acct:slug@host");

  let actorUrl: string | null = null;

  if (raw.startsWith("acct:") || raw.includes("@") && !raw.includes("://")) {
    const acct = raw.startsWith("acct:") ? raw.slice(5) : raw;
    const [user, host] = acct.split("@");
    if (!user || !host) throw new Error("Invalid acct handle");
    const wf = `https://${host}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${user}@${host}`)}`;
    const doc = await fetchJson(wf, "application/jrd+json");
    const links = (doc.links as Array<Record<string, unknown>>) || [];
    const self = links.find(
      (l) =>
        l.rel === "self" &&
        String(l.type || "").includes("activity"),
    );
    actorUrl = asString(self?.href);
    if (!actorUrl) {
      // Family Circles fallback guess
      actorUrl = `https://${host}/ap/families/${encodeURIComponent(user)}`;
    }
  } else {
    const url = new URL(raw);
    if (url.origin === federationOrigin()) {
      throw new Error(
        "That URL is on this instance — use Follow on the circle page instead.",
      );
    }
    if (url.pathname.startsWith("/ap/families/")) {
      actorUrl = url.toString().replace(/\/$/, "");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      const famIdx = parts.indexOf("families");
      const slug = famIdx >= 0 ? parts[famIdx + 1] : null;
      if (!slug) {
        throw new Error(
          "Expected a Family Circles URL like https://host/families/slug",
        );
      }
      actorUrl = `${url.origin}/ap/families/${encodeURIComponent(slug)}`;
    }
  }

  const doc = await fetchJson(actorUrl);
  return parseActorDocument(doc);
}
