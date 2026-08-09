import type { LedgerType } from "@/generated/prisma/client";
import { subDays } from "date-fns";

/**
 * Pure arithmetic for customer credit. No database, no Prisma client — everything in
 * here is a plain function over ledger rows, so it can be reasoned about and checked
 * in isolation. Database access lives in customers.ts.
 */

/** CHARGE adds to the debt; payments and return credits reduce it. */
export const LEDGER_SIGN: Record<LedgerType, number> = {
  CHARGE: 1,
  PAYMENT: -1,
  RETURN_CREDIT: -1,
  // ADJUSTMENT carries a SIGNED amount: positive = owes more, negative = owes less.
  ADJUSTMENT: 1,
};

export type LedgerEntryLike = {
  type: LedgerType;
  amount: number;
  createdAt: Date;
};

/**
 * Money is held as JS numbers, matching the rest of the codebase. Adding many
 * 2-decimal values in binary floating point leaves crumbs — a fully settled account
 * can come out as 0.0000000000018 instead of 0. Left alone that crumb is greater than
 * zero, so a paid-up shop would still be counted as owing money and shown as
 * "LKR 0.00 outstanding". Rounding to cents at every boundary keeps comparisons honest.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** A negative balance means the customer has paid in advance. */
export function balanceOf(entries: { type: LedgerType; amount: number }[]): number {
  return roundMoney(
    entries.reduce((sum, e) => sum + LEDGER_SIGN[e.type] * e.amount, 0)
  );
}

/**
 * How much of a customer's debt has been owed longer than `days`.
 *
 * Payments are recorded against the account as a whole, not against a specific bill,
 * so ageing is worked out by applying every credit to the OLDEST charge first (FIFO).
 * This is a reporting view only — it never changes how payments are stored.
 */
export function overdueAmount(
  entries: LedgerEntryLike[],
  days = 30,
  now: Date = new Date()
): number {
  const cutoff = subDays(now, days);
  const ordered = [...entries].sort((a, b) => +a.createdAt - +b.createdAt);

  // Charges awaiting settlement, oldest first.
  const open: { amount: number; createdAt: Date }[] = [];
  let credit = 0;

  for (const e of ordered) {
    const signed = LEDGER_SIGN[e.type] * e.amount;
    if (signed > 0) {
      open.push({ amount: signed, createdAt: e.createdAt });
    } else {
      credit += -signed;
    }
  }

  // Settle oldest charges first.
  for (const charge of open) {
    if (credit <= 0) break;
    const applied = Math.min(credit, charge.amount);
    charge.amount -= applied;
    credit -= applied;
  }

  return roundMoney(
    open
      .filter((c) => roundMoney(c.amount) > 0 && c.createdAt < cutoff)
      .reduce((sum, c) => sum + c.amount, 0)
  );
}
