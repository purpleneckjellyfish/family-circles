import "dotenv/config";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import {
  closeDb,
  families,
  familyMemberships,
  getDb,
  media,
  posts,
  users,
} from "../db";
import { ensureLocalFamilyActor, buildFamilyActorJson } from "../lib/federation/actor";
import { buildOutboxCollection } from "../lib/federation/outbox";
import { ingestRemoteNote } from "../lib/federation/ingest";
import { upsertRemoteFamilyCache } from "../lib/federation/follow";
import { hashPassword } from "../lib/password";
import { federationOrigin, localHost, webfingerAcct } from "../lib/federation/urls";

async function main() {
  const db = getDb();
  const email = `phase8-${Date.now()}@example.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: "Phase Eight",
      passwordHash: await hashPassword("password123"),
    })
    .returning();

  const slug = `phase8-${randomBytes(2).toString("hex")}`;
  const [family] = await db
    .insert(families)
    .values({ name: "Phase 8 Family", slug })
    .returning();
  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: user.id,
    role: "owner",
  });

  const actor = await ensureLocalFamilyActor(family.id);
  if (!actor.remoteUri || !actor.publicKeyPem || !actor.privateKeyPem) {
    throw new Error("actor keys missing");
  }
  const doc = buildFamilyActorJson(actor);
  if (doc.type !== "Group" || !doc.inbox || !doc.outbox) {
    throw new Error("actor json incomplete");
  }

  const outbox = await buildOutboxCollection(actor);
  if (outbox.type !== "OrderedCollection") {
    throw new Error("outbox shape");
  }

  // Simulate a remote family cache + ingested note (no second host required).
  const remote = await upsertRemoteFamilyCache({
    id: "https://remote.example/ap/families/cousins",
    name: "Cousins",
    preferredUsername: "cousins",
    summary: "Remote test",
    inbox: "https://remote.example/ap/families/cousins/inbox",
    outbox: "https://remote.example/ap/families/cousins/outbox",
    sharedInbox: null,
    publicKeyPem: null,
    allowFederatedComments: true,
    host: "remote.example",
  });

  const noteId = "https://remote.example/ap/notes/11111111-1111-4111-8111-111111111111";
  await ingestRemoteNote({
    familyId: remote.id,
    object: {
      id: noteId,
      type: "Note",
      attributedTo: remote.remoteUri,
      content: "Hello from the other Unraid",
      published: new Date().toISOString(),
      "fc:memoryDate": "2022-05-01",
      attachment: [
        {
          type: "Image",
          mediaType: "image/jpeg",
          url: "https://remote.example/ap/media/22222222-2222-4222-8222-222222222222",
        },
      ],
    },
  });

  const [cachedPost] = await db
    .select()
    .from(posts)
    .where(eq(posts.remoteUri, noteId))
    .limit(1);
  if (!cachedPost?.isRemote) throw new Error("remote post not cached");

  const mediaRows = await db
    .select()
    .from(media)
    .where(eq(media.postId, cachedPost.id));
  if (mediaRows.length !== 1 || mediaRows[0]!.storagePath || !mediaRows[0]!.remoteUri) {
    throw new Error("remote media should be URL-only");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        origin: federationOrigin(),
        host: localHost(),
        webfinger: webfingerAcct(actor.slug),
        actorId: actor.remoteUri,
        outboxItems: outbox.totalItems,
        remoteCacheSlug: remote.slug,
        remotePostId: cachedPost.id,
        remoteMedia: mediaRows[0]!.remoteUri,
      },
      null,
      2,
    ),
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
