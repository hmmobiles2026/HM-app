import { addMonths, differenceInCalendarDays } from "date-fns";

/**
 * Pure warranty logic — no database, no Prisma. Safe to import from client
 * components; the DB-backed defaults live in warranty.ts, which must never be
 * imported into a "use client" file.
 */

/** Used when the WarrantyConfig row has never been created. */
export const FALLBACK_WARRANTY_FEE = 200;
export const FALLBACK_WARRANTY_MONTHS = 3;

/** Periods offered in the sale form and in Settings. */
export const WARRANTY_MONTH_OPTIONS = [1, 3, 6, 12] as const;

export function warrantyUntilFrom(soldAt: Date, months: number): Date {
  return addMonths(soldAt, months);
}

export type WarrantyStatus =
  | { state: "none" }
  | { state: "covered"; until: Date; daysLeft: number }
  | { state: "expired"; until: Date; daysAgo: number };

/**
 * Whether a sold item is still under warranty. Compares against the date stamped at
 * the time of sale, so changing the shop default later never moves an existing cover.
 */
export function warrantyStatus(
  until: Date | null | undefined,
  now: Date = new Date()
): WarrantyStatus {
  if (!until) return { state: "none" };
  const days = differenceInCalendarDays(new Date(until), now);
  return days >= 0
    ? { state: "covered", until: new Date(until), daysLeft: days }
    : { state: "expired", until: new Date(until), daysAgo: -days };
}

export type WarrantyRefundPlan = {
  amount: number;
  /**
   * per-item — subtract this from the sale's running warranty total
   * legacy    — old whole-bill warranty; the sale's figure gets nulled instead
   * none      — nothing to refund
   */
  mode: "none" | "per-item" | "legacy";
};

/**
 * How much warranty comes back on a return, and how the sale's stored figure should
 * be adjusted.
 *
 * Two eras of data exist side by side. Sales made after per-item warranty have
 * `perUnitWarranty` set and refund only the units coming back. Older sales carry a
 * single whole-bill figure in `saleWarrantyFee`; those still refund all of it and
 * still null the field, which is what stops a second refund on those rows.
 *
 * Supplier returns never refund warranty — the customer keeps the cover.
 */
export function planWarrantyRefund({
  refundRequested,
  returnType,
  perUnitWarranty,
  saleWarrantyFee,
  saleUsesPerItemWarranty,
  quantity,
}: {
  refundRequested: boolean;
  returnType: "STOCK_BACK" | "SUPPLIER_RETURN";
  perUnitWarranty: number;
  saleWarrantyFee: number;
  /** True when ANY line on this sale carries per-item cover. */
  saleUsesPerItemWarranty: boolean;
  quantity: number;
}): WarrantyRefundPlan {
  if (!refundRequested || returnType !== "STOCK_BACK") return { amount: 0, mode: "none" };

  if (perUnitWarranty > 0) {
    const amount = Math.round(perUnitWarranty * quantity * 100) / 100;
    return amount > 0 ? { amount, mode: "per-item" } : { amount: 0, mode: "none" };
  }

  // This line has no cover. On a per-item sale that simply means "not covered" — the
  // sale's warranty total belongs to OTHER lines. Falling through to the legacy branch
  // here would refund someone else's warranty and wipe their cover, which is the very
  // bug per-item warranty exists to prevent.
  if (saleUsesPerItemWarranty) return { amount: 0, mode: "none" };

  if (saleWarrantyFee > 0) return { amount: saleWarrantyFee, mode: "legacy" };

  return { amount: 0, mode: "none" };
}

export function warrantyStatusLabel(status: WarrantyStatus): string {
  if (status.state === "none") return "";
  if (status.state === "expired") return "Expired";
  if (status.daysLeft === 0) return "Last day";
  if (status.daysLeft === 1) return "1 day left";
  if (status.daysLeft < 31) return `${status.daysLeft} days left`;
  const months = Math.floor(status.daysLeft / 30);
  return `${months} month${months > 1 ? "s" : ""} left`;
}
