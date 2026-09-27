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

  const localOk = canContribute(membership?.role);
  const remoteFollowOk =
    post.isRemote && family.allowFederatedComments && Boolean(follow);

  if (!localOk && !remoteFollowOk) {
    return {
      error: post.isRemote
        ? "This remote circle does not allow federated comments (or you do not follow it)."
        : "You need to be a member or collaborator to comment.",
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

  revalidatePath(`/families/${family.slug}/posts/${postId}`);
  revalidatePath("/home");
  revalidatePath(`/families/${family.slug}`);
  return { success: "commented" };
}
