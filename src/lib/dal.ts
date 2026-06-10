import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import {
  getAccessToken,
  getRefreshToken,
  verifyAccessToken,
  rotateSession,
} from "./session";
import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma/client";

export const verifySession = cache(async () => {
  // 1. Try access token (fast path — no DB hit)
  const accessToken = await getAccessToken();
  if (accessToken) {
    const session = await verifyAccessToken(accessToken);
    if (session) return session;
  }

  // 2. Access token missing/expired — try refresh token
  const refreshToken = await getRefreshToken();
  if (!refreshToken) redirect("/login");

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: {
      user: { select: { id: true, role: true, name: true, isActive: true } },
    },
  });

  if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
    redirect("/login");
  }

  // 3. Rotate: issue new access token + new refresh token
  const payload = {
    userId: stored.userId,
    role: stored.user.role,
    name: stored.user.name,
  };
  await rotateSession(refreshToken, payload);

  return payload;
});

export const verifyRole = cache(async (allowed: Role[]) => {
  const session = await verifySession();
  if (!allowed.includes(session.role)) redirect("/dashboard");
  return session;
});
