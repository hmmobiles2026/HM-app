import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { Role } from "@/generated/prisma/client";

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  return session;
});

export const verifyRole = cache(async (allowed: Role[]) => {
  const session = await verifySession();
  if (!allowed.includes(session.role)) redirect("/dashboard");
  return session;
});
