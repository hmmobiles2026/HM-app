import { prisma } from "@/lib/prisma";
import { FALLBACK_WARRANTY_FEE, FALLBACK_WARRANTY_MONTHS } from "@/lib/warranty-math";

/**
 * Database-backed warranty defaults.
 *
 * This module imports Prisma, so it must NOT be imported from a "use client" file —
 * client components should pull the pure helpers and constants from warranty-math.ts.
 *
 * Warranty is sold per unit on a sale line. Sale.warrantyFee is kept as the SUM of the
 * line warranties, so every existing report, backup and analytics query that reads it
 * keeps working untouched.
 */

export type WarrantyDefaults = { fee: number; months: number };

export async function getWarrantyDefaults(): Promise<WarrantyDefaults> {
  const row = await prisma.warrantyConfig.findFirst();
  return {
    fee: row ? row.defaultFee.toNumber() : FALLBACK_WARRANTY_FEE,
    months: row ? row.defaultMonths : FALLBACK_WARRANTY_MONTHS,
  };
}
