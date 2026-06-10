import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const config = await prisma.telegramConfig.findFirst({ where: { isActive: true } });
  if (!config) return new Response("OK", { status: 200 });

  const secretHeader = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secretHeader !== config.webhookSecret) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const message = body?.message;
  if (!message) return new Response("OK", { status: 200 });

  const chatId = String(message.chat.id);
  const text: string = (message.text ?? "").trim();

  await prisma.telegramLog.create({
    data: { direction: "IN", from: chatId, to: "bot", message: text },
  });

  const reply = await handleBotMessage(text);
  if (reply) {
    await sendTelegramMessage(config.botToken, chatId, reply);
    await prisma.telegramLog.create({
      data: { direction: "OUT", from: "bot", to: chatId, message: reply },
    });
  }

  return new Response("OK", { status: 200 });
}

async function handleBotMessage(text: string): Promise<string | null> {
  const t = text.toLowerCase();

  // Help
  if (["/start", "/help", "help", "hi", "hello", "hey"].includes(t)) {
    return buildHelpMessage();
  }

  // Summary shortcuts
  if (["today", "/today", "t"].includes(t)) return buildSummaryMessage("today");
  if (["week", "/week", "w"].includes(t)) return buildSummaryMessage("week");
  if (["month", "/month", "m"].includes(t)) return buildSummaryMessage("month");
  if (t.startsWith("/summary") || t.startsWith("summary")) return buildSummaryMessage(t);

  // Low stock
  if (["/lowstock", "lowstock", "low", "l"].includes(t)) return buildLowStockMessage();

  // Stock search
  if (t === "/stock" || t === "stock" || t === "s") return buildStockMessage("");
  if (t.startsWith("/stock ")) return buildStockMessage(text.slice(7).trim());
  if (t.startsWith("stock ")) return buildStockMessage(text.slice(6).trim());
  if (t.startsWith("s ")) return buildStockMessage(text.slice(2).trim());

  // Fallback — try as a stock search
  if (t.length >= 2) return buildStockMessage(text.trim());

  return (
    "❓ I didn't get that.\n\n" +
    "Quick commands:\n" +
    "• *today* — today's sales\n" +
    "• *week* — this week\n" +
    "• *low* — low stock items\n" +
    "• *stock iphone* — search stock\n" +
    "• *help* — all commands"
  );
}

async function buildHelpMessage(): Promise<string> {
  return (
    "🏪 *HM Stocks Bot*\n\n" +
    "*Sales Summary*\n" +
    "• today _(or /today, t)_\n" +
    "• week _(or /week, w)_\n" +
    "• month _(or /month, m)_\n\n" +
    "*Stock*\n" +
    "• stock _(overview)_\n" +
    "• stock samsung _(search)_\n" +
    "• s iphone 14 _(short form)_\n\n" +
    "*Alerts*\n" +
    "• low _(or /lowstock)_\n\n" +
    "_Any unrecognized text is treated as a stock search._"
  );
}

async function buildStockMessage(query: string): Promise<string> {
  if (!query) {
    const [total, value, lowCount] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.aggregate({ where: { isActive: true }, _sum: { stockQty: true } }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "Product"
        WHERE "isActive" = true AND "stockQty" <= "lowStockThreshold"
      `,
    ]);
    const low = Number(lowCount[0]?.count ?? 0);
    return (
      `📦 *Stock Overview*\n\n` +
      `SKUs: ${total}\n` +
      `Total items: ${value._sum.stockQty ?? 0}\n` +
      (low > 0 ? `⚠️ Low stock: ${low} items` : `✅ All levels healthy`)
    );
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { brand: { name: { contains: query, mode: "insensitive" } } },
        { model: { name: { contains: query, mode: "insensitive" } } },
        { name: { contains: query, mode: "insensitive" } },
        { tags: { has: query.toLowerCase() } },
      ],
    },
    include: { brand: true, model: true },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    take: 10,
  });

  if (products.length === 0) {
    return `❌ Nothing found for "*${query}*"\n\nTry: stock samsung · stock display · stock battery`;
  }

  const lines = products.map((p) => {
    const name = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} ${p.name}`;
    const isLow = p.stockQty <= p.lowStockThreshold;
    return `${isLow ? "⚠️" : "•"} ${name}: *${p.stockQty}* pcs`;
  });

  return `📦 *"${query}"*\n\n${lines.join("\n")}${products.length === 10 ? "\n\n_Showing top 10_" : ""}`;
}

async function buildSummaryMessage(text: string): Promise<string> {
  const now = new Date();
  let start: Date;
  let label: string;

  if (text.includes("week") || text === "w") {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    start.setHours(0, 0, 0, 0);
    label = "This Week";
  } else if (text.includes("month") || text === "m") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "This Month";
  } else {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    label = "Today";
  }

  const [sales, lowStock] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: start } },
      _sum: { totalRevenue: true, totalCost: true, profit: true },
      _count: true,
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Product"
      WHERE "isActive" = true AND "stockQty" <= "lowStockThreshold"
    `,
  ]);

  const revenue = Number(sales._sum.totalRevenue ?? 0);
  const profit = Number(sales._sum.profit ?? 0);
  const cost = Number(sales._sum.totalCost ?? 0);
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";
  const lowCount = Number(lowStock[0]?.count ?? 0);

  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

  return (
    `📊 *${label} Summary*\n\n` +
    `💰 Revenue: ${fmt(revenue)}\n` +
    `💸 Cost:    ${fmt(cost)}\n` +
    `📈 Profit:  ${fmt(profit)} _(${margin}%)_\n` +
    `🛒 Sales:   ${sales._count}\n\n` +
    (lowCount > 0 ? `⚠️ ${lowCount} item${lowCount > 1 ? "s" : ""} low on stock` : `✅ Stock levels OK`)
  );
}

async function buildLowStockMessage(): Promise<string> {
  const products = await prisma.$queryRaw<
    { name: string; stockQty: number; lowStockThreshold: number; brandName: string; modelName: string | null }[]
  >`
    SELECT p.name, p."stockQty", p."lowStockThreshold", b.name as "brandName", pm.name as "modelName"
    FROM "Product" p
    JOIN "Brand" b ON b.id = p."brandId"
    LEFT JOIN "PhoneModel" pm ON pm.id = p."modelId"
    WHERE p."isActive" = true AND p."stockQty" <= p."lowStockThreshold"
    ORDER BY p."stockQty" ASC
    LIMIT 15
  `;

  if (products.length === 0) {
    return "✅ *All stock levels are healthy!*";
  }

  const lines = products.map((p) => {
    const name = `${p.brandName}${p.modelName ? ` ${p.modelName}` : ""} ${p.name}`;
    const urgent = p.stockQty === 0 ? " 🔴 OUT" : "";
    return `• ${name}: *${p.stockQty}* left${urgent}`;
  });

  return `⚠️ *Low Stock — ${products.length} item${products.length > 1 ? "s" : ""}*\n\n${lines.join("\n")}`;
}
