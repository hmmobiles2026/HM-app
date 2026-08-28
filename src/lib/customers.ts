import { prisma } from "@/lib/prisma";
import type { LedgerType, PaymentMethod } from "@/generated/prisma/client";
import { LEDGER_SIGN, balanceOf, overdueAmount, roundMoney } from "@/lib/credit-math";
import type { LedgerEntryLike } from "@/lib/credit-math";
import { startOfMonth } from "date-fns";

/**
 * Customer credit (accounts receivable) — database access.
 *
 * A customer's outstanding balance is NEVER stored as a column. It is always derived
 * from the CustomerLedger rows, so it cannot drift out of sync with its own history.
 * The arithmetic itself lives in credit-math.ts.
 *
 * Nothing in here reads or writes Sale.totalRevenue / totalCost / profit. Credit is a
 * separate layer that sits beside the existing accrual figures — see
 * CUSTOMER_CREDIT_PLAN.md.
 */

export { balanceOf, overdueAmount };
export type { LedgerEntryLike };

export async function getCustomerBalance(customerId: string): Promise<number> {
  const groups = await prisma.customerLedger.groupBy({
    by: ["type"],
    where: { customerId },
    _sum: { amount: true },
  });
  return balanceOf(
    groups.map((g) => ({ type: g.type, amount: g._sum.amount?.toNumber() ?? 0 }))
  );
}

/**
 * Balances for every customer in a single query — use this on list pages so we never
 * fall into an N+1 of one balance query per row.
 *
 * A customer who has never transacted has no ledger rows and so is ABSENT from this
 * map. Callers must read it as `map.get(id) ?? 0`, not assume every customer is a key.
 */
export async function getCustomerBalanceMap(): Promise<Map<string, number>> {
  const groups = await prisma.customerLedger.groupBy({
    by: ["customerId", "type"],
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const g of groups) {
    const delta = LEDGER_SIGN[g.type] * (g._sum.amount?.toNumber() ?? 0);
    map.set(g.customerId, (map.get(g.customerId) ?? 0) + delta);
  }
  for (const [id, balance] of map) map.set(id, roundMoney(balance));
  return map;
}

/**
 * Date of each customer's most recent payment, in one query. Customers who have never
 * paid are absent from the map.
 */
export async function getLastPaymentMap(): Promise<Map<string, Date>> {
  const groups = await prisma.customerLedger.groupBy({
    by: ["customerId"],
    where: { type: "PAYMENT" },
    _max: { createdAt: true },
  });

  const map = new Map<string, Date>();
  for (const g of groups) {
    if (g._max.createdAt) map.set(g.customerId, g._max.createdAt);
  }
  return map;
}

/**
 * For each given sale, how much of it was left unpaid AT THE COUNTER that day.
 *
 * This is deliberately a snapshot of the moment of sale, not a live paid/unpaid
 * status. Payments are recorded against the account as a whole, so a sale has no
 * current settlement state of its own — later payments reduce the balance without
 * belonging to any particular bill. Labelling a row "unpaid" would become a lie as
 * soon as the customer pays anything.
 */
export async function getSaleCreditMap(
  saleIds: string[]
): Promise<Map<string, number>> {
  if (saleIds.length === 0) return new Map();

  const groups = await prisma.customerLedger.groupBy({
    by: ["saleId", "type"],
    where: { saleId: { in: saleIds } },
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const g of groups) {
    if (!g.saleId) continue;
    const amount = g._sum.amount?.toNumber() ?? 0;
    // Only the two rows written at the counter count: the CHARGE and the payment made
    // with it. Later payments carry no saleId at all. RETURN_CREDIT rows DO carry one,
    // and are excluded on purpose — a return weeks later must not rewrite what the
    // customer took away on credit that day.
    const delta = g.type === "CHARGE" ? amount : g.type === "PAYMENT" ? -amount : 0;
    map.set(g.saleId, (map.get(g.saleId) ?? 0) + delta);
  }
  for (const [id, value] of map) map.set(id, roundMoney(value));
  return map;
}

/** One product line behind a ledger entry, so a charge is recognisable later. */
export type LedgerLine = {
  label: string;
  quantity: number;
  unitPrice: number;
};

export type LedgerRow = {
  id: string;
  type: LedgerType;
  amount: number;
  saleId: string | null;
  returnId: string | null;
  method: PaymentMethod | null;
  note: string | null;
  createdAt: Date;
  createdByName: string;
  /**
   * What was actually bought or returned. "Sale #A4F2" on its own is unrecognisable
   * months later, so charges carry their products and return credits carry the part
   * that came back.
   */
  lines: LedgerLine[];
  /** Balance immediately after this entry. */
  balanceAfter: number;
};

/** "Samsung A54 — LCD Display (MEETOO)", the same shape used across the app. */
function productLabel(p: {
  name: string;
  brand: { name: string };
  model: { name: string } | null;
  partBrand: { name: string } | null;
}): string {
  const head = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""}`;
  const tail = p.partBrand ? ` (${p.partBrand.name})` : "";
  return `${head} — ${p.name}${tail}`;
}

/**
 * Full ledger for one customer, newest first, each row carrying the running balance
 * as it stood after that entry.
 *
 * Loads the customer's whole history because the running balance has to be
 * accumulated from the oldest entry forward. Fine for a shop's volume; if any single
 * customer ever reaches thousands of rows this needs an opening-balance + page
 * approach instead.
 */
export async function getCustomerLedger(customerId: string): Promise<LedgerRow[]> {
  const entries = await prisma.customerLedger.findMany({
    where: { customerId },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { name: true } } },
  });

  // Two batched lookups rather than one per row: the products on each charged sale,
  // and the specific part behind each return credit.
  const saleIds = [
    ...new Set(entries.filter((e) => e.type === "CHARGE" && e.saleId).map((e) => e.saleId!)),
  ];
  const returnIds = [...new Set(entries.filter((e) => e.returnId).map((e) => e.returnId!))];

  const [saleItems, returns] = await Promise.all([
    saleIds.length
      ? prisma.saleItem.findMany({
          where: { saleId: { in: saleIds } },
          include: { product: { include: { brand: true, model: true, partBrand: true } } },
        })
      : [],
    returnIds.length
      ? prisma.saleReturn.findMany({
          where: { id: { in: returnIds } },
          include: {
            saleItem: {
              include: { product: { include: { brand: true, model: true, partBrand: true } } },
            },
          },
        })
      : [],
  ]);

  const linesBySale = new Map<string, LedgerLine[]>();
  for (const item of saleItems) {
    const list = linesBySale.get(item.saleId) ?? [];
    list.push({
      label: productLabel(item.product),
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
    });
    linesBySale.set(item.saleId, list);
  }

  const lineByReturn = new Map<string, LedgerLine>();
  for (const r of returns) {
    lineByReturn.set(r.id, {
      label: productLabel(r.saleItem.product),
      quantity: r.quantity,
      unitPrice: r.saleItem.unitPrice.toNumber(),
    });
  }

  let running = 0;
  const ascending = entries.map((e) => {
    const amount = e.amount.toNumber();
    running += LEDGER_SIGN[e.type] * amount;

    const returnLine = e.returnId ? lineByReturn.get(e.returnId) : undefined;
    const lines = returnLine
      ? [returnLine]
      : e.type === "CHARGE" && e.saleId
        ? (linesBySale.get(e.saleId) ?? [])
        : [];

    return {
      id: e.id,
      type: e.type,
      amount,
      saleId: e.saleId,
      returnId: e.returnId,
      method: e.method,
      note: e.note,
      createdAt: e.createdAt,
      createdByName: e.createdBy.name,
      lines,
      balanceAfter: running,
    };
  });

  return ascending.reverse();
}

export type CustomerSummary = {
  outstanding: number;
  lifetimeBusiness: number;
  totalPaid: number;
  lastPaymentAt: Date | null;
};

export async function getCustomerSummary(customerId: string): Promise<CustomerSummary> {
  const [groups, lastPayment] = await Promise.all([
    prisma.customerLedger.groupBy({
      by: ["type"],
      where: { customerId },
      _sum: { amount: true },
    }),
    prisma.customerLedger.findFirst({
      where: { customerId, type: "PAYMENT" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const totals = groups.map((g) => ({
    type: g.type,
    amount: g._sum.amount?.toNumber() ?? 0,
  }));
  const byType = new Map(totals.map((t) => [t.type, t.amount]));

  return {
    outstanding: balanceOf(totals),
    lifetimeBusiness: roundMoney(byType.get("CHARGE") ?? 0),
    totalPaid: roundMoney(byType.get("PAYMENT") ?? 0),
    lastPaymentAt: lastPayment?.createdAt ?? null,
  };
}

export type ReceivablesSummary = {
  totalOutstanding: number;
  shopsWithDues: number;
  overdue30: number;
  collectedThisMonth: number;
};

/**
 * Shop-wide receivables figures for the dashboard.
 *
 * `collectedThisMonth` counts payments from credit customers only — walk-in cash
 * sales create no ledger rows, so this is NOT total cash taken. Label it accordingly
 * wherever it is shown.
 *
 * Reads every ledger row because FIFO ageing needs each customer's full history in
 * order. At this shop's volume (a handful of rows per credit sale) that stays small
 * for years. If the ledger ever reaches tens of thousands of rows, move the ageing
 * into SQL rather than letting the dashboard scan the table.
 */
export async function getReceivablesSummary(
  now: Date = new Date()
): Promise<ReceivablesSummary> {
  const [entries, collected] = await Promise.all([
    prisma.customerLedger.findMany({
      select: { customerId: true, type: true, amount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customerLedger.aggregate({
      where: { type: "PAYMENT", createdAt: { gte: startOfMonth(now) } },
      _sum: { amount: true },
    }),
  ]);

  const byCustomer = new Map<string, LedgerEntryLike[]>();
  for (const e of entries) {
    const row = { type: e.type, amount: e.amount.toNumber(), createdAt: e.createdAt };
    const list = byCustomer.get(e.customerId);
    if (list) list.push(row);
    else byCustomer.set(e.customerId, [row]);
  }

  let totalOutstanding = 0;
  let shopsWithDues = 0;
  let overdue30 = 0;

  for (const list of byCustomer.values()) {
    const balance = balanceOf(list);
    // Customers in advance (negative balance) must not offset what others owe.
    if (balance > 0) {
      totalOutstanding += balance;
      shopsWithDues += 1;
      overdue30 += overdueAmount(list, 30, now);
    }
  }

  return {
    totalOutstanding: roundMoney(totalOutstanding),
    shopsWithDues,
    overdue30: roundMoney(overdue30),
    collectedThisMonth: roundMoney(collected._sum.amount?.toNumber() ?? 0),
  };
}
