"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import {
  families,
  familyMemberships,
  follows,
  getDb,
  invites,
} from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/slug";

const createFamilySchema = z.object({
  name: z.string().trim().min(2).max(80),
  summary: z.string().trim().max(280).optional(),
});

async function uniqueSlug(db: ReturnType<typeof getDb>, name: string) {
  const base = slugify(name);
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db
      .select({ id: families.id })
      .from(families)
      .where(eq(families.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function createFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createFamilySchema.safeParse({
    name: formData.get("name"),
    summary: formData.get("summary") || undefined,
  });

  if (!parsed.success) {
    return { error: "Give your circle a name (at least 2 characters)." };
  }

  const db = getDb();
  const slug = await uniqueSlug(db, parsed.data.name);

  const [family] = await db
    .insert(families)
    .values({
      name: parsed.data.name,
      slug,
      summary: parsed.data.summary || null,
    })
    .returning();

  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: user.id!,
    role: "owner",
  });

  redirect(`/families/${family.slug}`);
}

const inviteSchema = z.object({
  familyId: z.string().uuid(),
  role: z.enum(["adult", "follower"]),
});

/** Owners and adults can mint invite links for members or collaborators. */
export async function createInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse({
    familyId: formData.get("familyId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: "Could not create invite." };
  }

  const db = getDb();
  const [membership] = await db
    .select()
    .from(familyMemberships)
    .where(
      and(
        eq(familyMemberships.familyId, parsed.data.familyId),
        eq(familyMemberships.userId, user.id!),
      ),
    )
    .limit(1);

  if (!membership || (membership.role !== "owner" && membership.role !== "adult")) {
    return { error: "Only family owners and adults can invite people." };
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await db.insert(invites).values({
    familyId: parsed.data.familyId,
    token,
    role: parsed.data.role,
    createdByUserId: user.id!,
    expiresAt,
  });

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, parsed.data.familyId))
    .limit(1);

  revalidatePath(`/families/${family?.slug}`);
  return {
    success: token,
  };
}

export async function acceptInviteAction(token: string): Promise<ActionState> {
  const user = await requireUser();
  const db = getDb();

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  if (!invite || invite.acceptedAt) {
    return { error: "This invite is invalid or already used." };
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { error: "This invite has expired." };
  }

  const [existing] = await db
    .select()
    .from(familyMemberships)
    .where(
      and(
        eq(familyMemberships.familyId, invite.familyId),
        eq(familyMemberships.userId, user.id!),
      ),
    )
    .limit(1);

  if (existing) {
    return { error: "You are already part of this circle." };
  }

  // Invite role is adult (family member) or follower (collaborator).
  await db.insert(familyMemberships).values({
    familyId: invite.familyId,
    userId: user.id!,
    role: invite.role === "owner" ? "adult" : invite.role,
  });

  // Collaborator invites also create a follow so their home feed can include the circle (Phase 2).
  if (invite.role === "follower") {
    await db
      .insert(follows)
      .values({
        followerUserId: user.id!,
        familyId: invite.familyId,
        status: "accepted",
      })
      .onConflictDoNothing();
  }

  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.id, invite.id));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, invite.familyId))
    .limit(1);

  redirect(`/families/${family?.slug ?? ""}`);
}

const followSchema = z.object({
  familyId: z.string().uuid(),
});

/** Same-instance follow without an invite (timeline access; contribute needs follower membership). */
export async function followFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = followSchema.safeParse({
    familyId: formData.get("familyId"),
  });
  if (!parsed.success) {
    return { error: "Could not follow this circle." };
  }

  const db = getDb();
  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, parsed.data.familyId))
    .limit(1);

  if (!family) {
    return { error: "Circle not found." };
  }

  const [membership] = await db
    .select()
    .from(familyMemberships)
    .where(
      and(
        eq(familyMemberships.familyId, family.id),
        eq(familyMemberships.userId, user.id!),
      ),
    )
    .limit(1);

  if (membership && (membership.role === "owner" || membership.role === "adult")) {
    return { error: "You already belong to this circle as a family member." };
  }

  const [existingFollow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerUserId, user.id!),
        eq(follows.familyId, family.id),
      ),
    )
    .limit(1);

  if (existingFollow) {
    return { error: "You already follow this circle." };
  }

  await db.insert(follows).values({
    followerUserId: user.id!,
    familyId: family.id,
    status: "accepted",
  });

  // Ensure a follower membership so Phase 2 contribute rules have a single role source.
  if (!membership) {
    await db.insert(familyMemberships).values({
      familyId: family.id,
      userId: user.id!,
      role: "follower",
    });
  }

  revalidatePath(`/families/${family.slug}`);
  revalidatePath("/home");
  return { success: "Now following this circle." };
}

export async function unfollowFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = followSchema.safeParse({
    familyId: formData.get("familyId"),
  });
  if (!parsed.success) {
    return { error: "Could not update follow." };
  }

  const db = getDb();
  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, parsed.data.familyId))
    .limit(1);
  if (!family) return { error: "Circle not found." };

  const [membership] = await db
    .select()
    .from(familyMemberships)
    .where(
      and(
        eq(familyMemberships.familyId, family.id),
        eq(familyMemberships.userId, user.id!),
      ),
    )
    .limit(1);

  if (membership?.role === "owner" || membership?.role === "adult") {
    return { error: "Leave membership management to invites for family members." };
  }

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerUserId, user.id!),
        eq(follows.familyId, family.id),
      ),
    );

  if (membership?.role === "follower") {
    await db
      .delete(familyMemberships)
      .where(eq(familyMemberships.id, membership.id));
  }

  revalidatePath(`/families/${family.slug}`);
  revalidatePath("/home");
  return { success: "Unfollowed." };
}
