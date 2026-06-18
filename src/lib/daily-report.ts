import "server-only";
import { prisma } from "@/lib/prisma";

export async function buildDailyReport(): Promise<string> {
  const slOffset = 5.5 * 60 * 60 * 1000;
  const now = new Date();
  const slNow = new Date(now.getTime() + slOffset);
  const slStartOfDay = new Date(
    Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffset
  );

  const weekday = slNow.toLocaleDateString("en-LK", { weekday: "long", timeZone: "UTC" });
  const date = slNow.toLocaleDateString("en-LK", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

  const [summary, sales, lowStock, lostStock] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: slStartOfDay } },
      _sum: { totalRevenue: true, totalCost: true, profit: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: slStartOfDay } },
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
    prisma.$queryRaw<{ name: string; brandName: string; partBrandName: string | null; quantity: number; note: string | null }[]>`
      SELECT p.name, b.name as "brandName", pb.name as "partBrandName", sm.quantity, sm.note
      FROM "StockMovement" sm
      JOIN "Product" p ON p.id = sm."productId"
      JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN "PartBrand" pb ON pb.id = p."partBrandId"
      WHERE sm.type = 'ADJUSTMENT'
        AND sm.quantity < 0
        AND sm."createdAt" >= ${slStartOfDay}
      ORDER BY sm."createdAt" DESC
      LIMIT 10
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

  if (saleCount === 0) {
    return header + `\n\n_No sales recorded today._\n\n━━━━━━━━━━━━━━━━━━━━`;
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
      const partSuffix = p.partBrand ? ` (${p.partBrand.name})` : "";
      const name = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} ${p.name}${partSuffix}`;
      return `   • ${name} × ${it.quantity}`;
    }).join("\n");
    const note = sale.note ? `\n   📝 ${sale.note}` : "";
    return `${header}\n${itemLines}${note}`;
  }).join("\n\n");

  const salesSection =
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *TODAY'S SALES*\n\n` +
    salesLines +
    (hiddenCount > 0 ? `\n\n_...and ${hiddenCount} more transaction${hiddenCount > 1 ? "s" : ""}_` : "");

  const lowLines = lowStock.length > 0
    ? lowStock.map((p) => {
        const icon = p.stockQty === 0 ? "🔴" : "🟡";
        const partSuffix = p.partBrandName ? ` (${p.partBrandName})` : "";
        return `${icon} ${p.brandName} — ${p.name}${partSuffix}: *${p.stockQty}* left`;
      }).join("\n")
    : "✅ All stock levels OK";

  const lostSection = lostStock.length > 0
    ? `━━━━━━━━━━━━━━━━━━━━\n` +
      `📉 *WRITTEN OFF TODAY*\n` +
      lostStock.map((m) => {
        const note = m.note ? ` _(${m.note})_` : "";
        const partSuffix = m.partBrandName ? ` (${m.partBrandName})` : "";
        return `• ${m.brandName} — ${m.name}${partSuffix}: *${Math.abs(m.quantity)}* pcs${note}`;
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
    `━━━━━━━━━━━━━━━━━━━━`
  );
}
