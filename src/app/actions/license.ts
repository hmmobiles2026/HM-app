"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateLicenseKey } from "@/lib/license";
import { verifyRole } from "@/lib/dal";

export type LicenseActionState = { error?: string; success?: string } | undefined;

export async function activateLicense(
  _state: LicenseActionState,
  formData: FormData
): Promise<LicenseActionState> {
  await verifyRole(["ADMIN"]);

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
