import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, createSession } from "./session";
import type { Role } from "@/generated/prisma/client";

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  // Rolling session: extend to 7 days whenever < 3 days remain
  const remaining = new Date(session.expiresAt).getTime() - Date.now();
  if (remaining < THREE_DAYS) {
    await createSession({
      userId: session.userId,
      role: session.role,
      name: session.name,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  return session;
});

export const verifyRole = cache(async (allowed: Role[]) => {
  const session = await verifySession();
  if (!allowed.includes(session.role)) redirect("/dashboard");
  return session;
});
