"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { families, getDb, milestones, people } from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { canModerate, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

const createSchema = z.object({
  familyId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["anniversary", "other"]),
  occursOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  personId: z.string().uuid().optional().nullable(),
});

export async function createMilestoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const personRaw = String(formData.get("personId") ?? "").trim();
  const parsed = createSchema.safeParse({
    familyId: formData.get("familyId"),
    title: formData.get("title"),
    kind: formData.get("kind") || "anniversary",
    occursOn: formData.get("occursOn"),
    personId: personRaw || null,
  });

  if (!parsed.success) {
    return { error: "Add a title and a date for this milestone." };
  }

  const membership = await getMembership(user.id!, parsed.data.familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can add milestones." };
  }

  const db = getDb();
  if (parsed.data.personId) {
    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(
        and(
          eq(people.id, parsed.data.personId),
          eq(people.familyId, parsed.data.familyId),
        ),
      )
      .limit(1);
    if (!person) return { error: "Linked person is not in this circle." };
  }

  await db.insert(milestones).values({
    familyId: parsed.data.familyId,
    title: parsed.data.title,
    kind: parsed.data.kind,
    occursOn: parsed.data.occursOn,
    personId: parsed.data.personId || null,
  });

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, parsed.data.familyId))
    .limit(1);
  if (family) {
    revalidatePath(`/families/${family.slug}/milestones`);
    revalidatePath("/throwbacks");
    revalidatePath("/home");
  }
  return { success: "created" };
}

export async function deleteMilestoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const milestoneId = String(formData.get("milestoneId") ?? "");
  if (!z.string().uuid().safeParse(milestoneId).success) {
    return { error: "Invalid milestone." };
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(milestones)
    .where(eq(milestones.id, milestoneId))
    .limit(1);
  if (!row) return { error: "Milestone not found." };

  const membership = await getMembership(user.id!, row.familyId);
  if (!canModerate(membership?.role)) {
    return { error: "Only owners and adults can remove milestones." };
  }

  await db.delete(milestones).where(eq(milestones.id, milestoneId));

  const [family] = await db
    .select({ slug: families.slug })
    .from(families)
    .where(eq(families.id, row.familyId))
    .limit(1);
  if (family) {
    revalidatePath(`/families/${family.slug}/milestones`);
    revalidatePath("/throwbacks");
    revalidatePath("/home");
  }
  return { success: "deleted" };
}
