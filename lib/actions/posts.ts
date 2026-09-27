"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";

import {
  albumPosts,
  albums,
  families,
  getDb,
  media,
  people,
  postPeople,
  posts,
} from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { removeMediaFiles, storeImageFile, storeVideoFile } from "@/lib/media-storage";
import {
  canCreatePost,
  canDeletePost,
  canEditPost,
  canModerate,
  getMembership,
} from "@/lib/permissions";
import { notifyNewFamilyPost } from "@/lib/push";
import { requireUser } from "@/lib/session";
import { ensureLocalFamilyActor } from "@/lib/federation/actor";
import { fanOutLocalPost } from "@/lib/federation/activities";

const occasionSchema = z.enum(["none", "christmas", "birthday", "easter", "other"]);

function revalidateFamily(slug: string, postId?: string) {
  revalidatePath("/home");
  revalidatePath(`/families/${slug}`);
  revalidatePath(`/families/${slug}/albums`);
  revalidatePath(`/families/${slug}/browse`);
  if (postId) {
    revalidatePath(`/families/${slug}/posts/${postId}`);
  }
}

export async function createPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const familyId = String(formData.get("familyId") ?? "");
  const familySlug = String(formData.get("familySlug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  let memoryDate = String(formData.get("memoryDate") ?? "").trim() || null;
  const albumId = String(formData.get("albumId") ?? "").trim() || null;
  const occasionRaw = String(formData.get("occasion") ?? "none").trim() || "none";
  const occasionLabel =
    String(formData.get("occasionLabel") ?? "").trim() || null;
  const personIds = formData
    .getAll("personIds")
    .map(String)
    .filter(Boolean);

  if (!z.string().uuid().safeParse(familyId).success) {
    return { error: "Invalid family." };
  }

  const occasionParsed = occasionSchema.safeParse(occasionRaw);
  if (!occasionParsed.success) {
    return { error: "Invalid occasion." };
  }
  const occasion = occasionParsed.data;

  if (!(await canCreatePost(user.id!, familyId))) {
    return { error: "You cannot post in this circle." };
  }

  const photoFiles = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const videoFiles = formData
    .getAll("videos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!body && photoFiles.length === 0 && videoFiles.length === 0) {
    return { error: "Add a caption, photo, or video." };
  }
  if (photoFiles.length > 12) {
    return { error: "Up to 12 photos per memory for now." };
  }
  if (videoFiles.length > 3) {
    return { error: "Up to 3 videos per memory for now." };
  }

  const db = getDb();
  const [family] = await db
    .select({ slug: families.slug, name: families.name })
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);
  if (!family) return { error: "Circle not found." };

  if (albumId) {
    const [album] = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.familyId, familyId)))
      .limit(1);
    if (!album) return { error: "Album not found in this circle." };
  }

  if (personIds.length > 0) {
    const known = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.familyId, familyId));
    const knownSet = new Set(known.map((p) => p.id));
    if (personIds.some((id) => !knownSet.has(id))) {
      return { error: "A tagged person is not in this circle." };
    }
  }

  const [post] = await db
    .insert(posts)
    .values({
      familyId,
      authorUserId: user.id!,
      body: body || null,
      memoryDate,
      occasion,
      occasionLabel: occasion === "other" || occasion === "birthday" ? occasionLabel : null,
    })
    .returning();

  const stored: Array<{
    kind: "image" | "video";
    storagePath: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    sortOrder: number;
  }> = [];

  try {
    let order = 0;
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i]!;
      const { storagePath, mimeType, bytes } = await storeImageFile({
        familyId,
        postId: post.id,
        file,
        index: order,
      });
      let width: number | null = null;
      let height: number | null = null;
      try {
        const meta = await sharp(bytes).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        /* keep nulls if sharp cannot decode */
      }
      stored.push({
        kind: "image",
        storagePath,
        mimeType,
        width,
        height,
        durationMs: null,
        sortOrder: order,
      });
      order += 1;
    }

    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i]!;
      const video = await storeVideoFile({
        familyId,
        postId: post.id,
        file,
        index: order,
      });
      stored.push({
        kind: "video",
        storagePath: video.storagePath,
        mimeType: video.mimeType,
        width: video.width,
        height: video.height,
        durationMs: video.durationMs,
        sortOrder: order,
      });
      order += 1;
    }
  } catch (err) {
    await db.delete(posts).where(eq(posts.id, post.id));
    return {
      error:
        err instanceof Error ? err.message : "Could not store photos or video.",
    };
  }

  if (stored.length > 0) {
    await db.insert(media).values(
      stored.map((s) => ({
        postId: post.id,
        kind: s.kind,
        storagePath: s.storagePath,
        mimeType: s.mimeType,
        width: s.width,
        height: s.height,
        durationMs: s.durationMs,
        sortOrder: s.sortOrder,
      })),
    );
  }

  if (personIds.length > 0) {
    await db.insert(postPeople).values(
      personIds.map((personId) => ({ postId: post.id, personId })),
    );
  }

  if (albumId) {
    await db.insert(albumPosts).values({ albumId, postId: post.id });
  }

  const slug = familySlug || family.slug;

  const photoCount = stored.filter((s) => s.kind === "image").length;
  const videoCount = stored.filter((s) => s.kind === "video").length;
  const preview =
    body ||
    (videoCount && !photoCount
      ? videoCount === 1
        ? "shared a video"
        : `shared ${videoCount} videos`
      : photoCount === 1
        ? "shared a photo"
        : photoCount > 1
          ? `shared ${photoCount} photos`
          : "shared a memory");
  void notifyNewFamilyPost({
    familyId,
    familyName: family.name ?? slug,
    familySlug: slug,
    postId: post.id,
    authorUserId: user.id!,
    authorName: user.name ?? "Someone",
    preview,
  }).catch(() => undefined);

  void ensureLocalFamilyActor(familyId)
    .then((ready) => fanOutLocalPost({ family: ready, postId: post.id }))
    .catch(() => undefined);

  revalidateFamily(slug, post.id);
  redirect(`/families/${slug}/posts/${post.id}`);
}

export async function updatePostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const memoryDate = String(formData.get("memoryDate") ?? "").trim() || null;
  const occasionRaw = String(formData.get("occasion") ?? "none").trim() || "none";
  const occasionLabel =
    String(formData.get("occasionLabel") ?? "").trim() || null;
  const personIds = formData
    .getAll("personIds")
    .map(String)
    .filter(Boolean);

  if (!z.string().uuid().safeParse(postId).success) {
    return { error: "Invalid post." };
  }
  const occasionParsed = occasionSchema.safeParse(occasionRaw);
  if (!occasionParsed.success) {
    return { error: "Invalid occasion." };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { error: "Post not found." };

  const membership = await getMembership(user.id!, post.familyId);
  if (
    !canEditPost({
      viewerRole: membership?.role,
      viewerId: user.id!,
      authorId: post.authorUserId,
    })
  ) {
    return { error: "You cannot edit this memory." };
  }

  if (personIds.length > 0) {
    const known = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.familyId, post.familyId));
    const knownSet = new Set(known.map((p) => p.id));
    if (personIds.some((id) => !knownSet.has(id))) {
      return { error: "A tagged person is not in this circle." };
    }
  }

  const occasion = occasionParsed.data;
  await db
    .update(posts)
    .set({
      body: body || null,
      memoryDate,
      occasion,
      occasionLabel:
        occasion === "other" || occasion === "birthday" ? occasionLabel : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));

  await db.delete(postPeople).where(eq(postPeople.postId, postId));
  if (personIds.length > 0) {
    await db.insert(postPeople).values(
      personIds.map((personId) => ({ postId, personId })),
    );
  }

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) revalidateFamily(family.slug, postId);
  return { success: "updated" };
}

export async function deletePostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  if (!z.string().uuid().safeParse(postId).success) {
    return { error: "Invalid post." };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { error: "Post not found." };

  const membership = await getMembership(user.id!, post.familyId);
  if (
    !canDeletePost({
      viewerRole: membership?.role,
      viewerId: user.id!,
      authorId: post.authorUserId,
    })
  ) {
    return { error: "You cannot delete this memory." };
  }

  const mediaRows = await db.select().from(media).where(eq(media.postId, postId));
  await db.delete(posts).where(eq(posts.id, postId));

  for (const m of mediaRows) {
    await removeMediaFiles(m.storagePath);
  }

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) {
    revalidateFamily(family.slug);
    redirect(`/families/${family.slug}`);
  }
  return { success: "deleted" };
}

export async function hideFollowerPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  if (!z.string().uuid().safeParse(postId).success) {
    return { error: "Invalid post." };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { error: "Post not found." };

  const membership = await getMembership(user.id!, post.familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can hide contributions." };
  }

  const authorMembership = post.authorUserId
    ? await getMembership(post.authorUserId, post.familyId)
    : null;
  if (authorMembership?.role !== "follower") {
    return { error: "Only follower contributions can be hidden this way." };
  }

  await db
    .update(posts)
    .set({ hiddenAt: new Date(), updatedAt: new Date() })
    .where(eq(posts.id, postId));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) revalidateFamily(family.slug, postId);
  return { success: "hidden" };
}

export async function unhidePostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  if (!z.string().uuid().safeParse(postId).success) {
    return { error: "Invalid post." };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { error: "Post not found." };

  const membership = await getMembership(user.id!, post.familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can unhide posts." };
  }

  await db
    .update(posts)
    .set({ hiddenAt: null, updatedAt: new Date() })
    .where(eq(posts.id, postId));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) revalidateFamily(family.slug, postId);
  return { success: "unhidden" };
}

export async function removeFollowerPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  if (!z.string().uuid().safeParse(postId).success) {
    return { error: "Invalid post." };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { error: "Post not found." };

  const membership = await getMembership(user.id!, post.familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can remove follower contributions." };
  }

  const authorMembership = post.authorUserId
    ? await getMembership(post.authorUserId, post.familyId)
    : null;
  if (authorMembership?.role !== "follower") {
    return { error: "Only follower contributions can be removed this way." };
  }

  const mediaRows = await db.select().from(media).where(eq(media.postId, postId));
  await db.delete(posts).where(eq(posts.id, postId));

  for (const m of mediaRows) {
    await removeMediaFiles(m.storagePath);
  }

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) {
    revalidateFamily(family.slug);
    redirect(`/families/${family.slug}`);
  }
  return { success: "removed" };
}
