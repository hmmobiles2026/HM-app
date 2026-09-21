import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/credit-math";
import { startOfMonth } from "date-fns";
import type { StockAdjustmentReason } from "@/generated/prisma/client";

/**
 * Stock written off, valued at what it cost.
 *
 * Reported as its own figure and never deducted from sale profit — the same treatment
 * as customer dues, so no existing revenue or profit number changes. Read the two side
 * by side: a good month can still be losing stock.
 */

export const REASON_LABEL: Record<StockAdjustmentReason, string> = {
  DAMAGED: "Damaged",
  WRONG_ITEM: "Wrong item",
  LOST: "Lost",
  COUNT_CORRECTION: "Count correction",
  OTHER: "Other",
};

export type StockLossSummary = {
  /** Cost you will not get back. Claimed stock is excluded — that money is coming back. */
  lossValue: number;
  /** Cost of claimed stock still waiting on the supplier. */
  pendingClaimValue: number;
  /** Claims the supplier has already settled this month. */
  recoveredValue: number;
  /** Every unit removed, claimed or not. */
  units: number;
  /** Units covered by a supplier claim. */
  claimedUnits: number;
  byReason: { reason: StockAdjustmentReason; units: number; lossValue: number }[];
};

export async function getStockLossSummary(now: Date = new Date()): Promise<StockLossSummary> {
  // Only removals count. A positive adjustment is a count correction, not a gain, so
  // including it would quietly net away real losses.
  const rows = await prisma.stockMovement.findMany({
    where: {
      type: "ADJUSTMENT",
      quantity: { lt: 0 },
      createdAt: { gte: startOfMonth(now) },
    },
    select: {
      quantity: true,
      unitCost: true,
      reason: true,
      claimAmount: true,
      claimStatus: true,
    },
  });

  let lossValue = 0;
  let pendingClaimValue = 0;
  let recoveredValue = 0;
  let units = 0;
  let claimedUnits = 0;
  const grouped = new Map<StockAdjustmentReason, { units: number; lossValue: number }>();

  for (const r of rows) {
    const qty = Math.abs(r.quantity);
    // Older rows may predate the cost snapshot; count the units, value what we can.
    const cost = r.unitCost ? r.unitCost.toNumber() * qty : 0;
    const claim = r.claimAmount ? r.claimAmount.toNumber() : 0;

    units += qty;

    let lineLoss: number;
    if (r.claimStatus) {
      claimedUnits += qty;
      // Only the shortfall is lost. Claim 2,400 against a 2,400 part and nothing is
      // gone; claim 2,000 and the remaining 400 is a real loss.
      lineLoss = Math.max(0, cost - claim);
      if (r.claimStatus === "RESOLVED") recoveredValue += claim;
      else pendingClaimValue += claim;
    } else {
      lineLoss = cost;
    }

    lossValue += lineLoss;

    const key = r.reason ?? "OTHER";
    const cur = grouped.get(key) ?? { units: 0, lossValue: 0 };
    grouped.set(key, { units: cur.units + qty, lossValue: cur.lossValue + lineLoss });
  }

  return {
    lossValue: roundMoney(lossValue),
    pendingClaimValue: roundMoney(pendingClaimValue),
    recoveredValue: roundMoney(recoveredValue),
    units,
    claimedUnits,
    byReason: [...grouped.entries()]
      .map(([reason, v]) => ({ reason, units: v.units, lossValue: roundMoney(v.lossValue) }))
      .sort((a, b) => b.lossValue - a.lossValue || b.units - a.units),
  };
}

export type StockClaim = {
  id: string;
  productLabel: string;
  quantity: number;
  claimAmount: number;
  supplierName: string | null;
  reason: StockAdjustmentReason | null;
  note: string | null;
  status: "PENDING" | "RESOLVED";
  resolvedAt: Date | null;
  createdAt: Date;
};

/**
 * Claims raised against a supplier for stock that was never sold. Shown alongside
 * sale-based supplier returns so there is one place to chase a supplier, not two.
 */
export async function getStockClaims(): Promise<StockClaim[]> {
  const rows = await prisma.stockMovement.findMany({
    where: { type: "ADJUSTMENT", claimStatus: { not: null } },
    include: {
      supplier: { select: { name: true } },
      product: { include: { brand: true, model: true, partBrand: true } },
    },
    orderBy: [{ claimStatus: "asc" }, { createdAt: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    productLabel: `${r.product.brand.name}${r.product.model ? ` ${r.product.model.name}` : ""} — ${r.product.name}${r.product.partBrand ? ` (${r.product.partBrand.name})` : ""}`,
    quantity: Math.abs(r.quantity),
    claimAmount: r.claimAmount ? r.claimAmount.toNumber() : 0,
    supplierName: r.supplier?.name ?? null,
    reason: r.reason,
    note: r.note,
    status: r.claimStatus as "PENDING" | "RESOLVED",
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
  }));
}
