"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rm } from "node:fs/promises";
import path from "node:path";
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
import { memoryDateFromImageBytes } from "@/lib/exif";
import { absoluteMediaPath, storeImageFile } from "@/lib/media-storage";
import {
  canContribute,
  canModerate,
  getMembership,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";

function revalidateFamily(slug: string) {
  revalidatePath("/home");
  revalidatePath(`/families/${slug}`);
  revalidatePath(`/families/${slug}/albums`);
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
  const personIds = formData
    .getAll("personIds")
    .map(String)
    .filter(Boolean);

  if (!z.string().uuid().safeParse(familyId).success) {
    return { error: "Invalid family." };
  }

  const membership = await getMembership(user.id!, familyId);
  if (!canContribute(membership?.role)) {
    return { error: "You cannot post in this circle." };
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!body && files.length === 0) {
    return { error: "Add a caption or at least one photo." };
  }
  if (files.length > 12) {
    return { error: "Up to 12 photos per memory for now." };
  }

  const db = getDb();
  const [family] = await db
    .select({ slug: families.slug })
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

  // Create post first so media paths can include postId.
  const [post] = await db
    .insert(posts)
    .values({
      familyId,
      authorUserId: user.id!,
      body: body || null,
      memoryDate,
    })
    .returning();

  const stored: Array<{
    storagePath: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    sortOrder: number;
    exifDate: string | null;
  }> = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const { storagePath, mimeType, bytes } = await storeImageFile({
        familyId,
        postId: post.id,
        file,
        index: i,
      });
      let width: number | null = null;
      let height: number | null = null;
      try {
        const meta = await sharp(bytes).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        /* keep nulls if sharp cannot decode (e.g. HEIC without support) */
      }
      const exifDate = await memoryDateFromImageBytes(bytes);
      stored.push({
        storagePath,
        mimeType,
        width,
        height,
        sortOrder: i,
        exifDate,
      });
    }
  } catch (err) {
    await db.delete(posts).where(eq(posts.id, post.id));
    return {
      error: err instanceof Error ? err.message : "Could not store photos.",
    };
  }

  // If the form left memory date blank, prefill from earliest EXIF (server-side backup).
  if (!memoryDate) {
    const exifDates = stored
      .map((s) => s.exifDate)
      .filter((d): d is string => Boolean(d))
      .sort();
    if (exifDates[0]) {
      memoryDate = exifDates[0];
      await db
        .update(posts)
        .set({ memoryDate, updatedAt: new Date() })
        .where(eq(posts.id, post.id));
    }
  }

  if (stored.length > 0) {
    await db.insert(media).values(
      stored.map((s) => ({
        postId: post.id,
        kind: "image" as const,
        storagePath: s.storagePath,
        mimeType: s.mimeType,
        width: s.width,
        height: s.height,
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
  revalidateFamily(slug);
  redirect(`/families/${slug}/posts/${post.id}`);
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
  if (family) revalidateFamily(family.slug);
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
  if (family) revalidateFamily(family.slug);
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
    if (!m.storagePath) continue;
    try {
      const abs = absoluteMediaPath(m.storagePath);
      await rm(abs, { force: true });
      // Best-effort cleanup of empty dirs is skipped to keep Phase 2 simple.
      void path.dirname(abs);
    } catch {
      /* file may already be gone */
    }
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
