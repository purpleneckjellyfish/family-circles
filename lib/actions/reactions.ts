"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  families,
  follows,
  getDb,
  postReactions,
  posts,
} from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import {
  canCommentOrReact,
  getMembership,
} from "@/lib/permissions";
import { REACTION_EMOJIS } from "@/lib/reactions";
import { requireUser } from "@/lib/session";

const emojiSchema = z.enum(REACTION_EMOJIS);

export async function setReactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const emojiRaw = String(formData.get("emoji") ?? "");

  if (!z.string().uuid().safeParse(postId).success) {
    return { error: "Invalid post." };
  }
  const emojiParsed = emojiSchema.safeParse(emojiRaw);
  if (!emojiParsed.success) {
    return { error: "Pick a reaction." };
  }
  const emoji = emojiParsed.data;

  const db = getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post || post.hiddenAt) {
    return { error: "Post not found." };
  }

  const membership = await getMembership(user.id!, post.familyId);
  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerUserId, user.id!),
        eq(follows.familyId, post.familyId),
        eq(follows.status, "accepted"),
      ),
    )
    .limit(1);

  if (!canCommentOrReact(membership?.role) && !follow) {
    return { error: "Join or follow this circle to react." };
  }

  const [existing] = await db
    .select()
    .from(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.userId, user.id!),
      ),
    )
    .limit(1);

  if (existing && existing.emoji === emoji) {
    await db.delete(postReactions).where(eq(postReactions.id, existing.id));
  } else if (existing) {
    await db
      .update(postReactions)
      .set({ emoji })
      .where(eq(postReactions.id, existing.id));
  } else {
    await db.insert(postReactions).values({
      postId,
      userId: user.id!,
      emoji,
    });
  }

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);

  revalidatePath("/home");
  if (family) {
    revalidatePath(`/families/${family.slug}`);
    revalidatePath(`/families/${family.slug}/posts/${postId}`);
  }
  return { success: "reacted" };
}
