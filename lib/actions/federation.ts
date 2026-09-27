"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/actions/auth";
import { followRemoteFamilyForUser } from "@/lib/federation/follow";
import { requireUser } from "@/lib/session";

export async function followRemoteFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const input = String(formData.get("remoteUrl") ?? "").trim();
  if (!input) {
    return { error: "Paste a remote family URL or acct:slug@host." };
  }

  try {
    const result = await followRemoteFamilyForUser({
      userId: user.id!,
      inputUrl: input,
    });
    revalidatePath("/home");
    revalidatePath("/browse");
    revalidatePath(`/families/${result.cache.slug}`);
    return {
      success: `Following ${result.cache.name} on ${result.actor.host}.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not follow that remote circle.",
    };
  }
}
