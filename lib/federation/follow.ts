import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import {
  families,
  federatedFollowers,
  follows,
  getDb,
  familyMemberships,
} from "@/db";
import { ensureLocalFamilyActor, isLocalFamily } from "@/lib/federation/actor";
import { discoverRemoteFamily } from "@/lib/federation/discover";
import { deliverActivity, fetchJson } from "@/lib/federation/deliver";
import { ingestCreateActivity } from "@/lib/federation/ingest";
import { localHost } from "@/lib/federation/urls";
import { slugify } from "@/lib/slug";

function remoteCacheSlug(host: string, username: string) {
  const hostPart = slugify(host.replace(/\./g, "-")).slice(0, 24);
  const userPart = slugify(username).slice(0, 24);
  const hash = createHash("sha1")
    .update(`${host}:${username}`)
    .digest("hex")
    .slice(0, 6);
  return `ext-${hostPart}-${userPart}-${hash}`.slice(0, 80);
}

/** Upsert a local cache row for a remote family actor. */
export async function upsertRemoteFamilyCache(actor: {
  id: string;
  name: string;
  preferredUsername: string;
  summary: string | null;
  inbox: string;
  outbox: string;
  sharedInbox: string | null;
  publicKeyPem: string | null;
  allowFederatedComments: boolean;
  host: string;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(families)
    .where(eq(families.remoteUri, actor.id))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(families)
      .set({
        name: actor.name,
        summary: actor.summary,
        actorInbox: actor.inbox,
        actorOutbox: actor.outbox,
        actorSharedInbox: actor.sharedInbox,
        publicKeyPem: actor.publicKeyPem,
        allowFederatedComments: actor.allowFederatedComments,
        instanceHost: actor.host,
        updatedAt: new Date(),
      })
      .where(eq(families.id, existing.id))
      .returning();
    return updated!;
  }

  const slug = remoteCacheSlug(actor.host, actor.preferredUsername);
  const [created] = await db
    .insert(families)
    .values({
      name: actor.name,
      slug,
      summary: actor.summary,
      remoteUri: actor.id,
      instanceHost: actor.host,
      actorInbox: actor.inbox,
      actorOutbox: actor.outbox,
      actorSharedInbox: actor.sharedInbox,
      publicKeyPem: actor.publicKeyPem,
      allowFederatedComments: actor.allowFederatedComments,
    })
    .returning();
  return created!;
}

/**
 * Follow a remote Family Circles family by URL/acct.
 * Sends Follow from the user's first owned local family actor.
 */
export async function followRemoteFamilyForUser(opts: {
  userId: string;
  inputUrl: string;
}) {
  const actor = await discoverRemoteFamily(opts.inputUrl);
  const cache = await upsertRemoteFamilyCache(actor);

  const db = getDb();
  const owned = await db
    .select({ family: families })
    .from(familyMemberships)
    .innerJoin(families, eq(families.id, familyMemberships.familyId))
    .where(
      and(
        eq(familyMemberships.userId, opts.userId),
        eq(familyMemberships.role, "owner"),
      ),
    )
    .limit(5);

  const localOwned = owned
    .map((r) => r.family)
    .filter((f) => isLocalFamily(f));

  if (localOwned.length === 0) {
    throw new Error(
      "Create a local circle first — federation Follow is sent as your circle’s actor.",
    );
  }

  const localFamily = await ensureLocalFamilyActor(localOwned[0]!.id);
  const followId = `${localFamily.remoteUri}/follows/${createHash("sha1").update(actor.id + opts.userId).digest("hex").slice(0, 12)}`;

  const followActivity = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: followId,
    type: "Follow",
    actor: localFamily.remoteUri,
    object: actor.id,
  };

  await deliverActivity({
    inboxUrl: actor.sharedInbox || actor.inbox,
    activity: followActivity,
    privateKeyPem: localFamily.privateKeyPem!,
    keyId: `${localFamily.remoteUri}#main-key`,
  });

  const [existingFollow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerUserId, opts.userId),
        eq(follows.familyId, cache.id),
      ),
    )
    .limit(1);

  if (!existingFollow) {
    await db.insert(follows).values({
      followerUserId: opts.userId,
      familyId: cache.id,
      status: "accepted",
      remoteUri: followId,
      instanceHost: actor.host,
    });
  } else {
    await db
      .update(follows)
      .set({
        status: "accepted",
        remoteUri: followId,
        instanceHost: actor.host,
      })
      .where(eq(follows.id, existingFollow.id));
  }

  // Pull recent outbox items so the timeline is useful immediately.
  try {
    const outbox = await fetchJson(actor.outbox);
    const items =
      (outbox.orderedItems as unknown[]) ||
      (outbox.first as { orderedItems?: unknown[] } | undefined)?.orderedItems ||
      [];
    for (const item of items.slice(0, 20)) {
      if (!item || typeof item !== "object") continue;
      const activity = item as Record<string, unknown>;
      if (activity.type === "Create" || activity.object) {
        await ingestCreateActivity({
          familyId: cache.id,
          activity:
            activity.type === "Create"
              ? activity
              : {
                  type: "Create",
                  object: activity,
                  actor: actor.id,
                },
        });
      }
    }
  } catch {
    // Outbox sync is best-effort; live Creates still arrive via inbox.
  }

  return { cache, localFamily, actor };
}

/** Record a remote Follow of a local family and auto-Accept (v1 policy). */
export async function acceptIncomingFollow(opts: {
  localFamilyId: string;
  activity: Record<string, unknown>;
}) {
  const db = getDb();
  const family = await ensureLocalFamilyActor(opts.localFamilyId);
  const actorUri =
    typeof opts.activity.actor === "string"
      ? opts.activity.actor
      : (opts.activity.actor as { id?: string } | undefined)?.id;
  if (!actorUri) return;

  let inboxUri = actorUri.includes("/inbox") ? actorUri : null;
  let sharedInbox: string | null = null;
  let publicKeyPem: string | null = null;
  try {
    const remote = await fetchJson(actorUri);
    inboxUri =
      (typeof remote.inbox === "string" ? remote.inbox : null) || inboxUri;
    sharedInbox =
      typeof (remote.endpoints as { sharedInbox?: string } | undefined)
        ?.sharedInbox === "string"
        ? (remote.endpoints as { sharedInbox: string }).sharedInbox
        : typeof remote.sharedInbox === "string"
          ? remote.sharedInbox
          : null;
    publicKeyPem =
      typeof (remote.publicKey as { publicKeyPem?: string } | undefined)
        ?.publicKeyPem === "string"
        ? (remote.publicKey as { publicKeyPem: string }).publicKeyPem
        : null;
  } catch {
    /* still Accept if we at least have actor URI */
  }
  if (!inboxUri) {
    // Guess Family Circles inbox path
    inboxUri = `${actorUri.replace(/\/$/, "")}/inbox`;
  }

  const followUri =
    typeof opts.activity.id === "string" ? opts.activity.id : null;

  await db
    .insert(federatedFollowers)
    .values({
      familyId: family.id,
      actorUri,
      inboxUri,
      sharedInboxUri: sharedInbox,
      publicKeyPem,
      status: "accepted",
      followActivityUri: followUri,
    })
    .onConflictDoUpdate({
      target: [federatedFollowers.familyId, federatedFollowers.actorUri],
      set: {
        inboxUri,
        sharedInboxUri: sharedInbox,
        publicKeyPem,
        status: "accepted",
        followActivityUri: followUri,
      },
    });

  if (family.privateKeyPem && family.remoteUri) {
    const accept = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${family.remoteUri}/accepts/${createHash("sha1").update(actorUri).digest("hex").slice(0, 12)}`,
      type: "Accept",
      actor: family.remoteUri,
      object: opts.activity,
    };
    try {
      await deliverActivity({
        inboxUrl: sharedInbox || inboxUri,
        activity: accept,
        privateKeyPem: family.privateKeyPem,
        keyId: `${family.remoteUri}#main-key`,
      });
    } catch {
      /* Accept delivery best-effort */
    }
  }
}

export function federationEnabledHost() {
  return localHost();
}
