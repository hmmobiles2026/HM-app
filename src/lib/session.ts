import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma/client";

export type SessionPayload = {
  userId: string;
  role: Role;
  name: string;
};

const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
const ACCESS_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── JWT access token ────────────────────────────────────────────────────────

export async function signAccessToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ── Cookie helpers ──────────────────────────────────────────────────────────

const SECURE = process.env.NODE_ENV === "production";

async function setCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const base = { httpOnly: true, secure: SECURE, sameSite: "lax" as const, path: "/" };
  store.set("access_token", accessToken, {
    ...base,
    expires: new Date(Date.now() + ACCESS_TTL_MS),
  });
  store.set("refresh_token", refreshToken, {
    ...base,
    expires: new Date(Date.now() + REFRESH_TTL_MS),
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function createSession(payload: SessionPayload) {
  const accessToken = await signAccessToken(payload);
  const refreshToken = randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  // Prune expired tokens for this user, then insert new one
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({
      where: { userId: payload.userId, expiresAt: { lt: new Date() } },
    }),
    prisma.refreshToken.create({
      data: { token: refreshToken, userId: payload.userId, expiresAt },
    }),
  ]);

  await setCookies(accessToken, refreshToken);
}

export async function rotateSession(oldRefreshToken: string, payload: SessionPayload) {
  const accessToken = await signAccessToken(payload);
  const newRefreshToken = randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { token: oldRefreshToken } }),
    prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: payload.userId, expiresAt },
    }),
  ]);

  await setCookies(accessToken, newRefreshToken);
}

export async function deleteSession() {
  const store = await cookies();
  const refreshToken = store.get("refresh_token")?.value;

  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }

  store.delete("access_token");
  store.delete("refresh_token");
}

export async function getAccessToken() {
  const store = await cookies();
  return store.get("access_token")?.value;
}

export async function getRefreshToken() {
  const store = await cookies();
  return store.get("refresh_token")?.value;
}

// Keep for backward-compat with any callers that still use the old name
export { getAccessToken as getSession };
