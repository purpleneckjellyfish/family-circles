import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb, media, posts, type families } from "@/db";
import { buildNoteActivity } from "@/lib/federation/activities";
import { familyOutboxUrl } from "@/lib/federation/urls";

type FamilyRow = typeof families.$inferSelect;

export async function buildOutboxCollection(family: FamilyRow) {
  const db = getDb();
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.familyId, family.id), eq(posts.isRemote, false)))
    .orderBy(desc(posts.postedAt))
    .limit(40);

  const mediaRows =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(media)
          .where(
            inArray(
              media.postId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(media.sortOrder);

  const orderedItems = rows.map((post) => {
    const attachments = mediaRows.filter((m) => m.postId === post.id);
    return buildNoteActivity({
      family,
      post,
      attachments: attachments.map((a) => ({
        id: a.id,
        kind: a.kind,
        mimeType: a.mimeType,
        width: a.width,
        height: a.height,
        durationMs: a.durationMs,
      })),
    });
  });

  const id = family.actorOutbox || familyOutboxUrl(family.slug);
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id,
    type: "OrderedCollection",
    totalItems: orderedItems.length,
    orderedItems,
  };
}
