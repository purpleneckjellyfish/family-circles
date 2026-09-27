import { and, eq } from "drizzle-orm";

import {
  federatedFollowers,
  getDb,
  media,
  posts,
  type families,
} from "@/db";
import { deliverActivity } from "@/lib/federation/deliver";
import {
  federatedMediaUrl,
  noteUrl,
} from "@/lib/federation/urls";

type FamilyRow = typeof families.$inferSelect;

export function buildNoteActivity(opts: {
  family: FamilyRow;
  post: {
    id: string;
    title?: string | null;
    body: string | null;
    memoryDate: string | null;
    postedAt: Date;
  };
  attachments: Array<{
    id: string;
    kind: "image" | "video";
    mimeType: string | null;
    width: number | null;
    height: number | null;
    durationMs?: number | null;
  }>;
}) {
  const actor = opts.family.remoteUri!;
  const objectId = noteUrl(opts.post.id);
  const published = opts.post.postedAt.toISOString();

  const attachment = opts.attachments.map((a) => ({
    type: a.kind === "video" ? "Video" : "Image",
    mediaType: a.mimeType || (a.kind === "video" ? "video/mp4" : "image/jpeg"),
    url: federatedMediaUrl(a.id),
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    duration: a.durationMs
      ? `PT${Math.round(a.durationMs / 1000)}S`
      : undefined,
  }));

  const object = {
    id: objectId,
    type: "Note",
    attributedTo: actor,
    name: opts.post.title || undefined,
    content: opts.post.body || "",
    published,
    url: objectId,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    attachment,
    "fc:memoryDate": opts.post.memoryDate || undefined,
  };

  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${objectId}/activity`,
    type: "Create",
    actor,
    published,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    object,
  };
}

/** Fan-out a local Create to accepted federated followers (best-effort). */
export async function fanOutLocalPost(opts: {
  family: FamilyRow;
  postId: string;
}) {
  if (!opts.family.remoteUri || !opts.family.privateKeyPem) return;

  const db = getDb();
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, opts.postId), eq(posts.isRemote, false)))
    .limit(1);
  if (!post) return;

  const attachments = await db
    .select()
    .from(media)
    .where(eq(media.postId, post.id))
    .orderBy(media.sortOrder);

  const activity = buildNoteActivity({
    family: opts.family,
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

  const followers = await db
    .select()
    .from(federatedFollowers)
    .where(
      and(
        eq(federatedFollowers.familyId, opts.family.id),
        eq(federatedFollowers.status, "accepted"),
      ),
    );

  const keyId = `${opts.family.remoteUri}#main-key`;
  await Promise.allSettled(
    followers.map((f) =>
      deliverActivity({
        inboxUrl: f.sharedInboxUri || f.inboxUri,
        activity,
        privateKeyPem: opts.family.privateKeyPem!,
        keyId,
      }),
    ),
  );
}
