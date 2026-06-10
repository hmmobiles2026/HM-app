"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string } | undefined;

// In-memory rate limiter: key = email, value = { attempts, resetAt }
// Not persistent across serverless restarts but significantly slows burst attacks
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const FAIL_DELAY_MS = 800; // artificial delay on every failure

function isRateLimited(email: string): boolean {
  const entry = loginAttempts.get(email);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(email);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(email: string) {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearAttempts(email: string) {
  loginAttempts.delete(email);
}

export async function login(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Invalid email or password." };

  const { email, password } = parsed.data;

  if (isRateLimited(email)) {
    return { error: "Too many failed attempts. Please wait 15 minutes and try again." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always run bcrypt compare to prevent timing-based user enumeration
  const fakeHash = "$2b$10$invalidhashpaddingtomakethisrealisticlooking000000000";
  const valid = user?.isActive
    ? await bcrypt.compare(password, user.password)
    : await bcrypt.compare(password, fakeHash).then(() => false);

  if (!valid) {
    recordFailedAttempt(email);
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return { error: "Invalid email or password." };
  }

  clearAttempts(email);
  await createSession({ userId: user!.id, role: user!.role, name: user!.name });

  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
