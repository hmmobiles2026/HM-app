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
  await prisma.brand.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: "Brand deleted." };
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
  await prisma.phoneModel.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: "Model deleted." };
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
  email: z.string().email(),
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
    return { error: "Email already in use." };
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
