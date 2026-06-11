import "server-only";
import { prisma } from "./prisma";
import { createHmac } from "crypto";
import { addMonths } from "date-fns";

const TRIAL_MONTHS = 4;
const LICENSE_SECRET = process.env.LICENSE_SECRET ?? "";

export type LicenseStatus = {
  active: boolean;
  isTrial: boolean;
  trialNotStarted: boolean;
  forceDeactivated: boolean;
  expiresAt: Date;
  daysLeft: number;
  expired: boolean;
  warningSoon: boolean;
};

export async function getLicenseStatus(): Promise<LicenseStatus> {
  let license = await prisma.appLicense.findFirst();
  if (!license) {
    license = await prisma.appLicense.create({ data: {} });
  }

  const now = new Date();

  // forceDeactivated flag OR old sentinel value (licensedUntil set to epoch by previous code)
  const isForceDeactivated = license.forceDeactivated || license.licensedUntil?.getTime() === 0;
  if (isForceDeactivated) {
    return { active: false, isTrial: false, trialNotStarted: false, forceDeactivated: true, expiresAt: now, daysLeft: 0, expired: true, warningSoon: false };
  }

  if (!license.trialStartedAt && !license.licensedUntil) {
    return { active: false, isTrial: true, trialNotStarted: true, forceDeactivated: false, expiresAt: now, daysLeft: 0, expired: false, warningSoon: false };
  }

  const trialEnd = license.trialStartedAt ? addMonths(license.trialStartedAt, TRIAL_MONTHS) : now;

  const expiresAt =
    license.licensedUntil && license.licensedUntil > trialEnd
      ? license.licensedUntil
      : trialEnd;

  const isTrial = !license.licensedUntil || license.licensedUntil <= trialEnd;
  const active = now < expiresAt;
  const daysLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 86400000));

  return { active, isTrial, trialNotStarted: false, forceDeactivated: false, expiresAt, daysLeft, expired: !active, warningSoon: daysLeft < 30 };
}

export function validateLicenseKey(key: string): { valid: boolean; expiresAt?: Date; error?: string } {
  if (!LICENSE_SECRET) return { valid: false, error: "LICENSE_SECRET not set on this server." };

  try {
    const decoded = Buffer.from(key.trim(), "base64url").toString("utf8");
    const colonIdx = decoded.lastIndexOf(":");
    if (colonIdx === -1) return { valid: false, error: "Invalid key format." };

    const data = decoded.slice(0, colonIdx);
    const sig = decoded.slice(colonIdx + 1);
    const expectedSig = createHmac("sha256", LICENSE_SECRET).update(data).digest("hex");

    if (sig !== expectedSig) return { valid: false, error: "Invalid license key." };

    const expiry = parseInt(data, 16);
    if (isNaN(expiry)) return { valid: false, error: "Corrupted key." };

    const expiresAt = new Date(expiry);
    if (expiresAt < new Date()) return { valid: false, error: "This license key has already expired." };

    return { valid: true, expiresAt };
  } catch {
    return { valid: false, error: "Invalid license key." };
  }
}
