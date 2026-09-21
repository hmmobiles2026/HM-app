import "server-only";
import { prisma } from "@/lib/prisma";
import { getReceivablesSummary } from "@/lib/customers";
import { reportDay, slDayBounds, SL_OFFSET_MS } from "@/lib/notify-schedule";

function escapeMd(s: string): string {
  return s.replace(/[_*`[]/g, "\\$&");
}

/**
 * The day's trading summary.
 *
 * `day` is a Sri Lanka calendar date (YYYY-MM-DD) and the report covers all of it,
 * midnight to midnight — a day that has already finished. It is NOT "since midnight
 * until now": this shop takes most of its money between 22:00 and midnight, so a
 * report that stopped at the moment it ran would leave out the busiest hours.
 */
export async function buildDailyReport(day: string = reportDay()): Promise<string> {
  const slOffset = SL_OFFSET_MS;
  const { start: slStartOfDay, end: slEndOfDay } = slDayBounds(day);
  const dayRange = { gte: slStartOfDay, lt: slEndOfDay };

  // Midday on the reported day, so formatting the label can never slip either side of
  // a boundary.
  const slLabelDate = new Date(`${day}T12:00:00.000Z`);
  const weekday = slLabelDate.toLocaleDateString("en-LK", { weekday: "long", timeZone: "UTC" });
  const date = slLabelDate.toLocaleDateString("en-LK", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

  const [
    summary,
    sales,
    lowStock,
    lostStock,
    pendingSupplierReturns,
    receivables,
    collectedToday,
    topDebtors,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: dayRange },
      _sum: { totalRevenue: true, totalCost: true, profit: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where: { createdAt: dayRange },
      include: {
        items: {
          include: {
            product: { include: { brand: true, model: true, partBrand: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.$queryRaw<{ name: string; brandName: string; partBrandName: string | null; stockQty: number }[]>`
      SELECT p.name, b.name as "brandName", pb.name as "partBrandName", p."stockQty"
      FROM "Product" p
      JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN "PartBrand" pb ON pb.id = p."partBrandId"
      WHERE p."isActive" = true AND p."stockQty" <= p."lowStockThreshold"
      ORDER BY p."stockQty" ASC
      LIMIT 10
    `,
    prisma.$queryRaw<{ name: string; brandName: string; partBrandName: string | null; quantity: number; note: string | null; reason: string | null; unitCost: string | null; claimAmount: string | null; claimStatus: string | null }[]>`
      SELECT p.name, b.name as "brandName", pb.name as "partBrandName", sm.quantity, sm.note,
             sm.reason::text as reason, sm."unitCost"::text as "unitCost",
             sm."claimAmount"::text as "claimAmount", sm."claimStatus"::text as "claimStatus"
      FROM "StockMovement" sm
      JOIN "Product" p ON p.id = sm."productId"
      JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN "PartBrand" pb ON pb.id = p."partBrandId"
      WHERE sm.type = 'ADJUSTMENT'
        AND sm.quantity < 0
        AND sm."createdAt" >= ${slStartOfDay}
        AND sm."createdAt" < ${slEndOfDay}
      ORDER BY sm."createdAt" DESC
      LIMIT 10
    `,
    prisma.saleReturn.findMany({
      where: { returnType: "SUPPLIER_RETURN", supplierStatus: "PENDING" },
      include: {
        supplier: { select: { name: true } },
        saleItem: {
          include: { product: { select: { name: true, brand: { select: { name: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // ── Customer credit ──────────────────────────────────────────────────────
    getReceivablesSummary(),
    prisma.customerLedger.aggregate({
      where: { type: "PAYMENT", createdAt: dayRange },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<{ shopName: string; balance: string }[]>`
      SELECT c."shopName",
             SUM(CASE
                   WHEN l.type = 'CHARGE' THEN l.amount
                   WHEN l.type = 'ADJUSTMENT' THEN l.amount
                   ELSE -l.amount
                 END)::text AS balance
      FROM "Customer" c
      JOIN "CustomerLedger" l ON l."customerId" = c.id
      GROUP BY c.id, c."shopName"
      HAVING SUM(CASE
                   WHEN l.type = 'CHARGE' THEN l.amount
                   WHEN l.type = 'ADJUSTMENT' THEN l.amount
                   ELSE -l.amount
                 END) > 0
      -- Order by the NUMERIC sum, not the "balance" alias: that alias is ::text, so
      -- sorting by it compares strings ("13000.00" < "9000.00") and picks the wrong
      -- shops for the top 5.
      ORDER BY SUM(CASE
                     WHEN l.type = 'CHARGE' THEN l.amount
                     WHEN l.type = 'ADJUSTMENT' THEN l.amount
                     ELSE -l.amount
                   END) DESC
      LIMIT 5
    `,
  ]);

  const revenue = summary._sum.totalRevenue?.toNumber() ?? 0;
  const cost = summary._sum.totalCost?.toNumber() ?? 0;
  const profit = summary._sum.profit?.toNumber() ?? 0;
  const saleCount = summary._count;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";

  const header =
    `📊 *DAILY SUMMARY — HM Stocks*\n` +
    `📅 ${weekday}, ${date}\n` +
    `━━━━━━━━━━━━━━━━━━━━`;

  // Credit owed by customer shops. Independent of the day's trading, so it is shown
  // even on a day with no sales. Revenue above already counts these amounts —
  // this section is about cash not yet collected.
  const paidToday = collectedToday._sum.amount?.toNumber() ?? 0;
  const creditSection =
    receivables.shopsWithDues > 0 || paidToday > 0
      ? `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧾 *CUSTOMER CREDIT*\n` +
        `Outstanding: *${fmt(receivables.totalOutstanding)}* from ${receivables.shopsWithDues} shop${receivables.shopsWithDues !== 1 ? "s" : ""}\n` +
        (receivables.overdue30 > 0 ? `⏳ Over 30 days: *${fmt(receivables.overdue30)}*\n` : "") +
        (paidToday > 0 ? `💰 Collected: *${fmt(paidToday)}*\n` : "") +
        (topDebtors.length > 0
          ? topDebtors
              .map((d) => `• ${escapeMd(d.shopName)}: ${fmt(Number(d.balance))}`)
              .join("\n") + "\n"
          : "") +
        `\n`
      : "";

  if (saleCount === 0) {
    return (
      header +
      `\n\n_No sales recorded._\n\n` +
      creditSection +
      `━━━━━━━━━━━━━━━━━━━━`
    );
  }

  const numerals = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳"];
  const shownSales = sales.slice(0, 20);
  const hiddenCount = sales.length - shownSales.length;

  const salesLines = shownSales.map((sale, i) => {
    const slTime = new Date(sale.createdAt.getTime() + slOffset);
    const time = slTime.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC" });
    const header = `${numerals[i] ?? `${i + 1}.`} ${time}  *${fmt(Number(sale.totalRevenue))}*  _(profit: ${fmt(Number(sale.profit))})_`;
    const itemLines = sale.items.map((it) => {
      const p = it.product;
      const partSuffix = p.partBrand ? ` (${escapeMd(p.partBrand.name)})` : "";
      const name = `${escapeMd(p.brand.name)}${p.model ? ` ${escapeMd(p.model.name)}` : ""} ${escapeMd(p.name)}${partSuffix}`;
      return `   • ${name} × ${it.quantity}`;
    }).join("\n");
    const note = sale.note ? `\n   📝 ${escapeMd(sale.note)}` : "";
    return `${header}\n${itemLines}${note}`;
  }).join("\n\n");

  const salesSection =
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *SALES*\n\n` +
    salesLines +
    (hiddenCount > 0 ? `\n\n_...and ${hiddenCount} more transaction${hiddenCount > 1 ? "s" : ""}_` : "");

  const lowLines = lowStock.length > 0
    ? lowStock.map((p) => {
        const icon = p.stockQty === 0 ? "🔴" : "🟡";
        const partSuffix = p.partBrandName ? ` (${escapeMd(p.partBrandName)})` : "";
        return `${icon} ${escapeMd(p.brandName)} — ${escapeMd(p.name)}${partSuffix}: *${p.stockQty}* left`;
      }).join("\n")
    : "✅ All stock levels OK";

  const reasonLabel: Record<string, string> = {
    DAMAGED: "damaged",
    WRONG_ITEM: "wrong item",
    LOST: "lost",
    COUNT_CORRECTION: "miscount",
    OTHER: "other",
  };
  // Claimed stock is not a loss — the supplier is covering it. Only the shortfall is.
  const lostValue = lostStock.reduce((s, m) => {
    const cost = Number(m.unitCost ?? 0) * Math.abs(m.quantity);
    const claim = Number(m.claimAmount ?? 0);
    return s + (m.claimStatus ? Math.max(0, cost - claim) : cost);
  }, 0);
  const claimedValue = lostStock.reduce(
    (s, m) => s + (m.claimStatus ? Number(m.claimAmount ?? 0) : 0),
    0
  );
  const lostSection = lostStock.length > 0
    ? `━━━━━━━━━━━━━━━━━━━━\n` +
      `📉 *WRITTEN OFF*\n` +
      (lostValue > 0 ? `Cost not recoverable: *${fmt(lostValue)}*\n` : "") +
      (claimedValue > 0 ? `🚚 Claimed from suppliers: *${fmt(claimedValue)}*\n` : "") +
      lostStock.map((m) => {
        const why = m.reason ? ` _(${reasonLabel[m.reason] ?? m.reason.toLowerCase()})_` : "";
        const note = m.note ? ` — ${escapeMd(m.note)}` : "";
        const partSuffix = m.partBrandName ? ` (${escapeMd(m.partBrandName)})` : "";
        const claimed = m.claimStatus ? " 🚚 claimed" : "";
        return `• ${escapeMd(m.brandName)} — ${escapeMd(m.name)}${partSuffix}: *${Math.abs(m.quantity)}* pcs${why}${claimed}${note}`;
      }).join("\n") + "\n\n"
    : "";

  const totalPendingClaim = pendingSupplierReturns.reduce((s, r) => s + Number(r.costRecovery ?? 0), 0);
  const supplierSection = pendingSupplierReturns.length > 0
    ? `━━━━━━━━━━━━━━━━━━━━\n` +
      `🚚 *PENDING SUPPLIER CLAIMS (${pendingSupplierReturns.length})*\n` +
      `Total: *${fmt(totalPendingClaim)}*\n` +
      pendingSupplierReturns.map((r) => {
        const p = r.saleItem.product;
        return `• ${escapeMd(p.brand.name)} — ${escapeMd(p.name)} × ${r.quantity}  _(${escapeMd(r.supplier?.name ?? "?")})_  ${fmt(Number(r.costRecovery ?? 0))}`;
      }).join("\n") + "\n\n"
    : "";

  return (
    header + `\n\n` +
    `💵 Revenue:  *${fmt(revenue)}*\n` +
    `📦 Cost:     ${fmt(cost)}\n` +
    `✅ Profit:   *${fmt(profit)}*\n` +
    `📈 Margin:   *${margin}%*\n` +
    `🛒 Sales:    ${saleCount} transaction${saleCount > 1 ? "s" : ""}\n\n` +
    salesSection + `\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ *LOW STOCK*\n` +
    `${lowLines}\n\n` +
    lostSection +
    supplierSection +
    creditSection +
    `━━━━━━━━━━━━━━━━━━━━`
  );
}
