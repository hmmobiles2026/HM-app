"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyRole, verifySession } from "@/lib/dal";

// ── Brands ──────────────────────────────────────────────────────────────────

export type ActionState = { error?: string; success?: string } | undefined;

export async function createBrand(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  await verifyRole(["ADMIN", "OWNER"]);
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required" };
  try {
    await prisma.brand.create({ data: { name } });
    revalidatePath("/settings");
    return { success: `Brand "${name}" created.` };
  } catch {
    return { error: "Brand already exists." };
  }
}

export async function deleteBrand(id: string): Promise<ActionState> {
  await verifyRole(["ADMIN"]);
  const now = new Date();
  await prisma.$transaction([
    prisma.phoneModel.updateMany({ where: { brandId: id, deletedAt: null }, data: { deletedAt: now } }),
    prisma.brand.update({ where: { id }, data: { deletedAt: now } }),
  ]);
  revalidatePath("/settings");
  return { success: "Brand moved to trash. You have 3 days to recover it." };
}

export async function recoverBrand(id: string): Promise<ActionState> {
  await verifyRole(["ADMIN"]);
  await prisma.$transaction([
    prisma.phoneModel.updateMany({ where: { brandId: id, deletedAt: { not: null } }, data: { deletedAt: null } }),
    prisma.brand.update({ where: { id }, data: { deletedAt: null } }),
  ]);
  revalidatePath("/settings");
  return { success: "Brand and its models recovered." };
}

// ── Models ───────────────────────────────────────────────────────────────────

export async function createModel(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  await verifyRole(["ADMIN", "OWNER"]);
  const name = (formData.get("name") as string)?.trim();
  const brandId = formData.get("brandId") as string;
  if (!name || !brandId) return { error: "All fields required" };
  try {
    await prisma.phoneModel.create({ data: { name, brandId } });
    revalidatePath("/settings");
    return { success: `Model "${name}" created.` };
  } catch {
    return { error: "Model already exists for this brand." };
  }
}

export async function deleteModel(id: string): Promise<ActionState> {
  await verifyRole(["ADMIN"]);
  await prisma.phoneModel.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/settings");
  return { success: "Model moved to trash. You have 3 days to recover it." };
}

export async function recoverModel(id: string): Promise<ActionState> {
  await verifyRole(["ADMIN"]);
  await prisma.phoneModel.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath("/settings");
  return { success: "Model recovered." };
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  await verifyRole(["ADMIN", "OWNER"]);
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required" };
  try {
    await prisma.category.create({ data: { name } });
    revalidatePath("/settings");
    return { success: `Category "${name}" created.` };
  } catch {
    return { error: "Category already exists." };
  }
}

export async function deleteCategory(id: string): Promise<ActionState> {
  await verifyRole(["ADMIN"]);
  await prisma.category.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: "Category deleted." };
}

// ── Users ─────────────────────────────────────────────────────────────────────

const UserSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "OWNER", "SELLER"]),
  whatsappNumber: z.string().optional(),
});

export async function createUser(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  await verifyRole(["ADMIN"]);
  const parsed = UserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { error: msgs[0] };
  }
  const { password, ...rest } = parsed.data;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({
      data: { ...rest, password: hashed, whatsappNumber: rest.whatsappNumber || null },
    });
    revalidatePath("/settings");
    return { success: `User "${rest.name}" created.` };
  } catch {
    return { error: "Username already taken." };
  }
}

export async function toggleUserActive(id: string, isActive: boolean): Promise<ActionState> {
  const session = await verifySession();
  if (session.role !== "ADMIN") return { error: "Unauthorized" };
  if (id === session.userId) return { error: "Cannot deactivate yourself." };
  await prisma.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/settings");
  return { success: isActive ? "User activated." : "User deactivated." };
}

export async function resetPassword(id: string, newPassword: string): Promise<ActionState> {
  await verifyRole(["ADMIN"]);
  if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  return { success: "Password reset." };
}

// ── Change own password ───────────────────────────────────────────────────────

export async function changePassword(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await verifySession();

  const current = (formData.get("currentPassword") as string) ?? "";
  const next = (formData.get("newPassword") as string) ?? "";
  const confirm = (formData.get("confirmPassword") as string) ?? "";

  if (!current || !next || !confirm) return { error: "All fields are required." };
  if (next.length < 6) return { error: "New password must be at least 6 characters." };
  if (next !== confirm) return { error: "Passwords do not match." };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "User not found." };

  const valid = await bcrypt.compare(current, user.password);
  if (!valid) return { error: "Current password is incorrect." };

  const hashed = await bcrypt.hash(next, 10);
  await prisma.user.update({ where: { id: session.userId }, data: { password: hashed } });

  return { success: "Password changed successfully." };
}
