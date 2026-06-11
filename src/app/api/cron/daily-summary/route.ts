import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Today in Sri Lanka time (UTC+5:30)
  const now = new Date();
  const slOffset = 5.5 * 60 * 60 * 1000;
  const slNow = new Date(now.getTime() + slOffset);
  const slStartOfDay = new Date(
    Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffset
  );

  const [summary, topItems, lowStock] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: slStartOfDay } },
      _sum: { totalRevenue: true, totalCost: true, profit: true },
      _count: true,
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: slStartOfDay } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.$queryRaw<{ name: string; brandName: string; stockQty: number }[]>`
      SELECT p.name, b.name as "brandName", p."stockQty"
      FROM "Product" p
      JOIN "Brand" b ON b.id = p."brandId"
      WHERE p."isActive" = true AND p."stockQty" <= p."lowStockThreshold"
      ORDER BY p."stockQty" ASC
      LIMIT 5
    `,
  ]);

  const revenue = summary._sum.totalRevenue?.toNumber() ?? 0;
  const cost = summary._sum.totalCost?.toNumber() ?? 0;
  const profit = summary._sum.profit?.toNumber() ?? 0;
  const saleCount = summary._count;

  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";
  const weekday = slNow.toLocaleDateString("en-LK", { weekday: "long", timeZone: "UTC" });
  const date = slNow.toLocaleDateString("en-LK", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

  if (saleCount === 0) {
    const config = await prisma.telegramConfig.findFirst();
    if (config) {
      await sendTelegramMessage(config.botToken, config.chatId,
        `📊 *DAILY SUMMARY — HM Stocks*\n` +
        `📅 ${weekday}, ${date}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `_No sales recorded today._\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`
      );
    }
    return NextResponse.json({ sent: true, sales: 0 });
  }

  // Fetch product names for top items
  const productIds = topItems.map((t) => t.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, brand: { select: { name: true } }, model: { select: { name: true } } },
  });

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const topLines = topItems.map((t, i) => {
    const p = products.find((x) => x.id === t.productId);
    const label = p ? `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}` : "Unknown";
    return `${medals[i] ?? "•"} ${label} × *${t._sum.quantity}*`;
  }).join("\n");

  const lowLines = lowStock.length > 0
    ? lowStock.map((p) => {
        const icon = p.stockQty === 0 ? "🔴" : "🟡";
        return `${icon} ${p.brandName} — ${p.name}: *${p.stockQty}* left`;
      }).join("\n")
    : "✅ All stock levels OK";

  const text =
    `📊 *DAILY SUMMARY — HM Stocks*\n` +
    `📅 ${weekday}, ${date}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💵 Revenue:  *LKR ${revenue.toLocaleString("en-LK")}*\n` +
    `📦 Cost:     LKR ${cost.toLocaleString("en-LK")}\n` +
    `✅ Profit:   *LKR ${profit.toLocaleString("en-LK")}*\n` +
    `📈 Margin:   *${margin}%*\n` +
    `🛒 Sales:    ${saleCount} transaction${saleCount > 1 ? "s" : ""}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏆 *TOP SOLD TODAY*\n` +
    `${topLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ *LOW STOCK*\n` +
    `${lowLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━`;

  const config = await prisma.telegramConfig.findFirst();
  if (config) {
    await sendTelegramMessage(config.botToken, config.chatId, text);
  }

  return NextResponse.json({ sent: !!config, sales: saleCount, revenue, profit });
}
