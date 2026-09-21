"use server";

import { createHmac } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateLicenseKey } from "@/lib/license";
import { broadcastTelegramMessage } from "@/lib/telegram";
import { DEFAULT_RENEWAL_TEXT } from "@/lib/license";
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

  await prisma.$transaction([
    prisma.appLicense.update({
      where: { id: license.id },
      data: { licensedUntil: result.expiresAt, forceDeactivated: false },
    }),
    prisma.telegramConfig.updateMany({ data: { isActive: true } }),
  ]);

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

  return { key, error: undefined };
}

export async function startFreeTrial(): Promise<LicenseActionState> {
  await verifyRole(["ADMIN"]);

  let license = await prisma.appLicense.findFirst();
  if (!license) {
    license = await prisma.appLicense.create({ data: {} });
  }

  await prisma.$transaction([
    prisma.appLicense.update({
      where: { id: license.id },
      data: { trialStartedAt: new Date(), forceDeactivated: false, licensedUntil: null },
    }),
    prisma.telegramConfig.updateMany({ data: { isActive: true } }),
  ]);

  const config = await prisma.telegramConfig.findFirst();
  if (config) {
    await broadcastTelegramMessage(
      config,
      `✅ *FREE TRIAL ACTIVATED — HM Stocks*\n\n` +
      `Your 4-month free trial has started.\n` +
      `Telegram alerts are now active.`,
      "Markdown"
    );
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "Free trial activated — 4 months started from today." };
}

export async function deactivateLicense(): Promise<LicenseActionState> {
  await verifyRole(["ADMIN"]);

  const license = await prisma.appLicense.findFirst();
  if (!license) return { error: "No license record found." };

  const config = await prisma.telegramConfig.findFirst();

  // Atomically: mark deactivated, delete all sessions, disable telegram config
  await prisma.$transaction([
    prisma.appLicense.update({
      where: { id: license.id },
      data: { forceDeactivated: true },
    }),
    prisma.telegramSession.deleteMany({}),
    ...(config
      ? [prisma.telegramConfig.update({ where: { id: config.id }, data: { isActive: false } })]
      : []),
  ]);

  // Send final payment reminder (outgoing sendMessage is unaffected by webhook state)
  // Suspension is always announced — telegramReminders only governs the routine
  // "expires soon" nudges, not the moment access is cut off.
  if (config) {
    const renewal = license.renewalText?.trim() || DEFAULT_RENEWAL_TEXT;
    const contact = license.supportContact?.trim();
    await broadcastTelegramMessage(
      config,
      `⚠️ *HM Stocks — Access Suspended*\n\n` +
      `Your access has been suspended.\n\n` +
      `Pay *${renewal}* to reactivate.\n\n` +
      (contact ? `Contact ${contact} to make payment.` : `Contact HM Stocks support to make payment.`),
      "Markdown"
    );
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "License deactivated. All Telegram features are now stopped." };
}

/**
 * Renewal reminder settings. Admin only — the shop owner is OWNER, so they cannot
 * silence the reminders for their own licence.
 */
export async function updateLicenseNotice(
  _state: LicenseActionState,
  formData: FormData
): Promise<LicenseActionState> {
  await verifyRole(["ADMIN"]);

  const license = await prisma.appLicense.findFirst();
  if (!license) return { error: "No license record found." };

  const days = Number(formData.get("warnDaysBefore"));
  if (!Number.isInteger(days) || days < 0 || days > 180) {
    return { error: "Reminder days must be between 0 and 180." };
  }

  const audience = String(formData.get("warningAudience") ?? "EVERYONE");
  if (!["EVERYONE", "OWNER_ADMIN", "NOBODY"].includes(audience)) {
    return { error: "Choose who should see the reminder." };
  }

  await prisma.appLicense.update({
    where: { id: license.id },
    data: {
      warnDaysBefore: days,
      warningAudience: audience as "EVERYONE" | "OWNER_ADMIN" | "NOBODY",
      telegramReminders: formData.get("telegramReminders") === "true",
      renewalText: (formData.get("renewalText") as string)?.trim() || null,
      supportContact: (formData.get("supportContact") as string)?.trim() || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {
    success:
      days === 0
        ? "Saved. The expiry reminder is switched off."
        : `Saved. Reminder starts ${days} days before expiry.`,
  };
}
