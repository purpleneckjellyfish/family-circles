import { and, eq, isNull, or } from "drizzle-orm";

import { families, getDb } from "@/db";
import { generateActorKeyPair } from "@/lib/federation/keys";
import {
  familyActorUrl,
  familyFollowersUrl,
  familyInboxUrl,
  familyOutboxUrl,
  localHost,
} from "@/lib/federation/urls";

export type FamilyRow = typeof families.$inferSelect;

/** Ensure a local family has actor IRIs + RSA keys for federation. */
export async function ensureLocalFamilyActor(
  familyId: string,
): Promise<FamilyRow> {
  const db = getDb();
  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);
  if (!family) throw new Error("Family not found");

  // Remote cache rows already have remoteUri pointing off-box.
  if (family.instanceHost && family.instanceHost !== localHost()) {
    return family;
  }

  if (
    family.remoteUri &&
    family.actorInbox &&
    family.publicKeyPem &&
    family.privateKeyPem
  ) {
    return family;
  }

  const keys = family.publicKeyPem && family.privateKeyPem
    ? {
        publicKeyPem: family.publicKeyPem,
        privateKeyPem: family.privateKeyPem,
      }
    : generateActorKeyPair();

  const remoteUri = familyActorUrl(family.slug);
  const [updated] = await db
    .update(families)
    .set({
      remoteUri,
      instanceHost: localHost(),
      actorInbox: familyInboxUrl(family.slug),
      actorOutbox: familyOutboxUrl(family.slug),
      actorSharedInbox: familyInboxUrl(family.slug),
      publicKeyPem: keys.publicKeyPem,
      privateKeyPem: keys.privateKeyPem,
      updatedAt: new Date(),
    })
    .where(eq(families.id, family.id))
    .returning();

  return updated!;
}

export function isLocalFamily(family: FamilyRow) {
  return !family.instanceHost || family.instanceHost === localHost();
}

export function buildFamilyActorJson(family: FamilyRow) {
  const id = family.remoteUri || familyActorUrl(family.slug);
  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],
    id,
    type: "Group",
    preferredUsername: family.slug,
    name: family.name,
    summary: family.summary ?? undefined,
    inbox: family.actorInbox || familyInboxUrl(family.slug),
    outbox: family.actorOutbox || familyOutboxUrl(family.slug),
    followers: familyFollowersUrl(family.slug),
    url: `${id.replace("/ap/families/", "/families/")}`,
    manuallyApprovesFollowers: false,
    discoverable: true,
    "fc:allowFederatedComments": family.allowFederatedComments,
    publicKey: {
      id: `${id}#main-key`,
      owner: id,
      publicKeyPem: family.publicKeyPem,
    },
  };
}

/** Look up a local family by slug that is owned on this instance. */
export async function getLocalFamilyBySlug(slug: string) {
  const db = getDb();
  const [family] = await db
    .select()
    .from(families)
    .where(
      and(
        eq(families.slug, slug),
        or(isNull(families.instanceHost), eq(families.instanceHost, localHost())),
      ),
    )
    .limit(1);
  return family ?? null;
}
