"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { families, getDb, media, posts } from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { memoryDateFromImageBytes } from "@/lib/exif";
import { storeImageFile } from "@/lib/media-storage";
import { canCreatePost } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

const MAX_PHOTOS = 24;
const PER_MEMORY = 12;

/** Older pictures, grouped by the day they were taken. New posts stay "today". */
export async function importPhotosAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const familyId = String(formData.get("familyId") ?? "");
  const files = formData
    .getAll("photos")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!familyId) return { error: "Choose a circle." };
  if (files.length === 0) return { error: "Choose some photos to bring in." };
  if (files.length > MAX_PHOTOS) {
    return { error: `Up to ${MAX_PHOTOS} photos at a time.` };
  }
  if (files.some((file) => !file.type.startsWith("image/"))) {
    return { error: "Bring in photos only. Video still goes through a new memory." };
  }
  if (!(await canCreatePost(user.id!, familyId))) {
    return { error: "You cannot add photos in this circle." };
  }

  const db = getDb();
  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);
  if (!family) return { error: "Circle not found." };

  const dated = new Map<string, File[]>();
  let undated = 0;
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const day = await memoryDateFromImageBytes(bytes);
    const key = day ?? "";
    if (!day) undated += 1;
    const list = dated.get(key) ?? [];
    list.push(file);
    dated.set(key, list);
  }

  const groups = [...dated.entries()].sort(([a], [b]) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a < b ? -1 : 1;
  });

  let saved = 0;
  try {
    for (const [day, group] of groups) {
      for (let start = 0; start < group.length; start += PER_MEMORY) {
        const chunk = group.slice(start, start + PER_MEMORY);
        const memoryDate = day || null;
        const [post] = await db
          .insert(posts)
          .values({
            familyId,
            authorUserId: user.id!,
            memoryDate,
            occasion: "none",
          })
          .returning();

        const stored = [];
        for (let index = 0; index < chunk.length; index++) {
          const file = chunk[index]!;
          const savedFile = await storeImageFile({
            familyId,
            postId: post.id,
            file,
            index,
          });
          let width: number | null = null;
          let height: number | null = null;
          try {
            const meta = await sharp(savedFile.bytes).metadata();
            width = meta.width ?? null;
            height = meta.height ?? null;
          } catch {
            /* keep nulls if sharp cannot decode */
          }
          stored.push({
            postId: post.id,
            kind: "image" as const,
            storagePath: savedFile.storagePath,
            mimeType: savedFile.mimeType,
            width,
            height,
            sortOrder: index,
          });
        }
        if (stored.length > 0) {
          await db.insert(media).values(stored);
        }
        saved += chunk.length;
      }
    }
  } catch (err) {
    revalidatePath("/home");
    return {
      error:
        err instanceof Error
          ? err.message
          : "Some photos could not be saved.",
    };
  }

  revalidatePath("/home");
  revalidatePath(`/families/${family.slug}`);
  revalidatePath(`/families/${family.slug}/browse`);

  const dayNote =
    undated === 0
      ? ""
      : undated === 1
        ? " 1 had no date, so it uses today."
        : ` ${undated} had no date, so those use today.`;
  return {
    success: `Brought in ${saved} ${saved === 1 ? "photo" : "photos"}.${dayNote}`,
  };
}
