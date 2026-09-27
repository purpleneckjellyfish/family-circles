import { eq } from "drizzle-orm";

import { getDb, media, posts } from "@/db";
import { notifyNewFamilyPost } from "@/lib/push";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

type Attachment = {
  type?: string;
  mediaType?: string;
  url?: string;
  href?: string;
  width?: number;
  height?: number;
};

/**
 * Upsert a remote Note into the local cache family row (no binary download).
 */
export async function ingestRemoteNote(opts: {
  familyId: string;
  object: Record<string, unknown>;
  activityId?: string | null;
}) {
  const objectId = asString(opts.object.id);
  if (!objectId) return null;

  const name = asString(opts.object.name);
  const contentRaw = asString(opts.object.content);
  const summary = asString(opts.object.summary);
  const title = name && (contentRaw || summary) ? name.slice(0, 140) : null;
  const content = contentRaw || (!title ? name : null) || summary || null;
  const published = asString(opts.object.published);
  const memoryDate =
    asString(opts.object["fc:memoryDate"]) ||
    (published ? published.slice(0, 10) : null);
  const instanceHost = hostOf(objectId);

  const db = getDb();
  const [existing] = await db
    .select()
    .from(posts)
    .where(eq(posts.remoteUri, objectId))
    .limit(1);

  let postId = existing?.id;
  if (existing) {
    await db
      .update(posts)
      .set({
        title,
        body: content,
        memoryDate,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, existing.id));
  } else {
    const [created] = await db
      .insert(posts)
      .values({
        familyId: opts.familyId,
        authorUserId: null,
        title,
        body: content,
        memoryDate,
        postedAt: published ? new Date(published) : new Date(),
        remoteUri: objectId,
        instanceHost,
        isRemote: true,
      })
      .returning();
    postId = created.id;

    // Notify local followers of this remote circle (best-effort).
    const { families } = await import("@/db");
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, opts.familyId))
      .limit(1);
    if (family) {
      void notifyNewFamilyPost({
        familyId: family.id,
        familyName: family.name,
        familySlug: family.slug,
        postId: created.id,
        authorUserId: "remote",
        authorName: family.name,
        preview: content || "shared a memory",
      }).catch(() => undefined);
    }
  }

  if (!postId) return null;

  // Replace remote media refs (URLs only — never mirror binaries).
  await db.delete(media).where(eq(media.postId, postId));
  const rawAtt =
    (opts.object.attachment as Attachment | Attachment[] | undefined) ?? [];
  const attachments = Array.isArray(rawAtt) ? rawAtt : [rawAtt];
  let order = 0;
  for (const att of attachments) {
    const url = asString(att.url) || asString(att.href);
    if (!url) continue;
    const type = (att.type || "").toLowerCase();
    const mime = asString(att.mediaType) || "";
    const kind =
      type.includes("video") || mime.startsWith("video/") ? "video" : "image";
    await db.insert(media).values({
      postId,
      kind,
      storagePath: null,
      remoteUri: url,
      mimeType: mime || null,
      width: typeof att.width === "number" ? att.width : null,
      height: typeof att.height === "number" ? att.height : null,
      sortOrder: order++,
    });
  }

  return postId;
}

export async function ingestCreateActivity(opts: {
  familyId: string;
  activity: Record<string, unknown>;
}) {
  const object = opts.activity.object;
  if (!object || typeof object !== "object") return null;
  const obj = object as Record<string, unknown>;
  const type = asString(obj.type);
  if (type && type !== "Note" && type !== "Article") {
    // Ignore non-note creates in v1.
    return null;
  }
  return ingestRemoteNote({
    familyId: opts.familyId,
    object: obj,
    activityId: asString(opts.activity.id),
  });
}
