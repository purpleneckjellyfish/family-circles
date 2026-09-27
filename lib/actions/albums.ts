"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { albums, families, getDb } from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { canModerate, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function createAlbumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const familyId = String(formData.get("familyId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!z.string().uuid().safeParse(familyId).success || title.length < 1) {
    return { error: "Give the album a title." };
  }

  const membership = await getMembership(user.id!, familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can create albums." };
  }

  const db = getDb();
  const [album] = await db
    .insert(albums)
    .values({ familyId, title, description })
    .returning();

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);

  if (family) {
    revalidatePath(`/families/${family.slug}`);
    revalidatePath(`/families/${family.slug}/albums`);
    redirect(`/families/${family.slug}/albums/${album.id}`);
  }
  return {};
}

export async function deleteAlbumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const albumId = String(formData.get("albumId") ?? "");
  if (!z.string().uuid().safeParse(albumId).success) {
    return { error: "Invalid album." };
  }

  const db = getDb();
  const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!album) return { error: "Album not found." };

  const membership = await getMembership(user.id!, album.familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can delete albums." };
  }

  await db.delete(albums).where(and(eq(albums.id, albumId)));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, album.familyId))
    .limit(1);
  if (family) {
    revalidatePath(`/families/${family.slug}/albums`);
    redirect(`/families/${family.slug}/albums`);
  }
  return { success: "deleted" };
}
