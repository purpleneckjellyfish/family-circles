"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  comments,
  families,
  familyMemberships,
  follows,
  getDb,
  posts,
} from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { deliverActivity } from "@/lib/federation/deliver";
import { ensureLocalFamilyActor, isLocalFamily } from "@/lib/federation/actor";
import { federationOrigin } from "@/lib/federation/urls";
import {
  canCommentOrReact,
  canDeleteComment,
  canEditComment,
  getMembership,
} from "@/lib/permissions";
import { notifyNewComment } from "@/lib/push";
import { requireUser } from "@/lib/session";

function revalidateCommentPaths(slug: string, postId: string) {
  revalidatePath(`/families/${slug}/posts/${postId}`);
  revalidatePath("/home");
  revalidatePath(`/families/${slug}`);
}

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

  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (!family) return { error: "Circle not found." };

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

  const localOk = canCommentOrReact(membership?.role);
  const remoteFollowOk =
    post.isRemote && family.allowFederatedComments && Boolean(follow);
  const followOk = Boolean(follow);

  if (!localOk && !remoteFollowOk && !followOk) {
    return {
      error: post.isRemote
        ? "This remote circle does not allow federated comments (or you do not follow it)."
        : "You need to be a member or follower to comment.",
    };
  }

  const [comment] = await db
    .insert(comments)
    .values({
      postId,
      authorUserId: user.id!,
      body,
      instanceHost: post.isRemote ? family.instanceHost : null,
    })
    .returning();

  if (post.isRemote && family.allowFederatedComments && post.remoteUri) {
    try {
      const owned = await db
        .select({ familyId: familyMemberships.familyId })
        .from(familyMemberships)
        .where(
          and(
            eq(familyMemberships.userId, user.id!),
            eq(familyMemberships.role, "owner"),
          ),
        )
        .limit(1);
      if (owned[0]) {
        const actorFamily = await ensureLocalFamilyActor(owned[0].familyId);
        if (
          isLocalFamily(actorFamily) &&
          actorFamily.remoteUri &&
          actorFamily.privateKeyPem &&
          family.actorInbox
        ) {
          const commentUri = `${federationOrigin()}/ap/comments/${comment.id}`;
          const activity = {
            "@context": "https://www.w3.org/ns/activitystreams",
            id: `${commentUri}/activity`,
            type: "Create",
            actor: actorFamily.remoteUri,
            object: {
              id: commentUri,
              type: "Note",
              attributedTo: actorFamily.remoteUri,
              inReplyTo: post.remoteUri,
              content: body,
              published: new Date().toISOString(),
            },
          };
          await deliverActivity({
            inboxUrl: family.actorSharedInbox || family.actorInbox,
            activity,
            privateKeyPem: actorFamily.privateKeyPem,
            keyId: `${actorFamily.remoteUri}#main-key`,
          });
          await db
            .update(comments)
            .set({ remoteUri: commentUri })
            .where(eq(comments.id, comment.id));
        }
      }
    } catch {
      /* keep local comment */
    }
  }

  void notifyNewComment({
    familyId: family.id,
    familyName: family.name,
    familySlug: family.slug,
    postId,
    commentAuthorUserId: user.id!,
    commentAuthorName: user.name ?? "Someone",
    preview: body,
    postAuthorUserId: post.authorUserId,
  }).catch(() => undefined);

  revalidateCommentPaths(family.slug, postId);
  return { success: "commented" };
}

export async function updateCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const commentId = String(formData.get("commentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!z.string().uuid().safeParse(commentId).success || body.length < 1) {
    return { error: "Write a short comment." };
  }
  if (body.length > 2000) {
    return { error: "Comment is too long." };
  }

  const db = getDb();
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!comment) return { error: "Comment not found." };

  if (
    !canEditComment({
      viewerId: user.id!,
      authorId: comment.authorUserId,
    })
  ) {
    return { error: "You can only edit your own comments." };
  }

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, comment.postId))
    .limit(1);
  if (!post) return { error: "Post not found." };

  await db
    .update(comments)
    .set({ body })
    .where(eq(comments.id, commentId));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) revalidateCommentPaths(family.slug, post.id);
  return { success: "updated" };
}

export async function deleteCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const commentId = String(formData.get("commentId") ?? "");
  if (!z.string().uuid().safeParse(commentId).success) {
    return { error: "Invalid comment." };
  }

  const db = getDb();
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!comment) return { error: "Comment not found." };

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, comment.postId))
    .limit(1);
  if (!post) return { error: "Post not found." };

  const membership = await getMembership(user.id!, post.familyId);
  if (
    !canDeleteComment({
      viewerRole: membership?.role,
      viewerId: user.id!,
      authorId: comment.authorUserId,
    })
  ) {
    return { error: "You cannot delete this comment." };
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (family) revalidateCommentPaths(family.slug, post.id);
  return { success: "deleted" };
}
