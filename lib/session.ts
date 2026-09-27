import { redirect } from "next/navigation";

import { auth } from "@/auth";

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user?.id) {
    redirect("/login");
  }
  return user;
}
