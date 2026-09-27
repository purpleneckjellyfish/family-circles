"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { families, getDb, people } from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { canModerate, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function createPersonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const familyId = String(formData.get("familyId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim() || null;

  if (!z.string().uuid().safeParse(familyId).success || displayName.length < 1) {
    return { error: "Enter a name for this person." };
  }

  const membership = await getMembership(user.id!, familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can add people tags." };
  }

  const db = getDb();
  await db.insert(people).values({
    familyId,
    displayName,
    birthday,
  });

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);
  if (family) {
    revalidatePath(`/families/${family.slug}`);
    revalidatePath(`/families/${family.slug}/people`);
    revalidatePath(`/families/${family.slug}/posts/new`);
  }
  return { success: "created" };
}

export async function deletePersonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const personId = String(formData.get("personId") ?? "");
  if (!z.string().uuid().safeParse(personId).success) {
    return { error: "Invalid person." };
  }

  const db = getDb();
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return { error: "Person not found." };

  const membership = await getMembership(user.id!, person.familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can remove people tags." };
  }

  await db.delete(people).where(and(eq(people.id, personId)));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, person.familyId))
    .limit(1);
  if (family) {
    revalidatePath(`/families/${family.slug}/people`);
    revalidatePath(`/families/${family.slug}/posts/new`);
  }
  return { success: "deleted" };
}
