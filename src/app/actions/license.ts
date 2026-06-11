"use server";

import { createHmac } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateLicenseKey } from "@/lib/license";
import { verifyRole } from "@/lib/dal";

export type LicenseActionState = { error?: string; success?: string } | undefined;

export async function activateLicense(
  _state: LicenseActionState,
  formData: FormData
): Promise<LicenseActionState> {
  await verifyRole(["ADMIN", "OWNER"]);

  const key = (formData.get("licenseKey") as string ?? "").trim();
  if (!key) return { error: "Please enter a license key." };

  const result = validateLicenseKey(key);
  if (!result.valid) return { error: result.error };

  let license = await prisma.appLicense.findFirst();
  if (!license) {
    license = await prisma.appLicense.create({ data: {} });
  }

  await prisma.appLicense.update({
    where: { id: license.id },
    data: { licensedUntil: result.expiresAt },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  const date = result.expiresAt!.toLocaleDateString("en-LK", {
    day: "2-digit", month: "long", year: "numeric",
  });
  return { success: `License activated — valid until ${date}.` };
}

export async function generateLicenseKey(
  _state: { key?: string; error?: string } | undefined,
  formData: FormData
): Promise<{ key?: string; error?: string }> {
  await verifyRole(["ADMIN"]);

  const secret = process.env.LICENSE_SECRET;
  if (!secret) return { error: "LICENSE_SECRET is not configured on this server." };

  const months = parseInt(formData.get("months") as string ?? "3");
  if (isNaN(months) || months < 1 || months > 24) return { error: "Invalid duration." };

  const expiry = Date.now() + months * 30 * 24 * 60 * 60 * 1000;
  const data = expiry.toString(16);
  const sig = createHmac("sha256", secret).update(data).digest("hex");
  const key = Buffer.from(`${data}:${sig}`).toString("base64url");

  const expiryDate = new Date(expiry).toLocaleDateString("en-LK", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return { key, error: undefined };
}

export async function deactivateLicense(): Promise<LicenseActionState> {
  await verifyRole(["ADMIN"]);

  const license = await prisma.appLicense.findFirst();
  if (!license) return { error: "No license record found." };

  // Set licensedUntil to past so it's immediately expired
  await prisma.appLicense.update({
    where: { id: license.id },
    data: { licensedUntil: new Date(0) },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "License deactivated. Telegram alerts are now disabled." };
}
