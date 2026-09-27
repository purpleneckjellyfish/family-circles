"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { comments, families, getDb, posts } from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { canContribute, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!z.string().uuid().safeParse(postId).success || body.length < 1) {
    return { error: "Write a short comment." };
  }
  if (body.length > 2000) {
    return { error: "Comment is too long." };
  }

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post || post.hiddenAt) {
    return { error: "Post not found." };
  }

  const membership = await getMembership(user.id!, post.familyId);
  if (!canContribute(membership?.role)) {
    return { error: "You need to be a member or collaborator to comment." };
  }

  await db.insert(comments).values({
    postId,
    authorUserId: user.id!,
    body,
  });

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) {
    revalidatePath(`/families/${family.slug}/posts/${postId}`);
    revalidatePath("/home");
    revalidatePath(`/families/${family.slug}`);
  }
  return { success: "commented" };
}
