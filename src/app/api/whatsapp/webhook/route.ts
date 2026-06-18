import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const config = await prisma.whatsAppConfig.findFirst({
    where: { isActive: true },
  });

  if (mode === "subscribe" && token === config?.webhookSecret) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (!message) return new Response("OK", { status: 200 });

  const from: string = message.from;
  const text: string = message.text?.body ?? "";

  await prisma.whatsAppLog.create({
    data: { direction: "IN", from, to: "bot", message: text },
  });

  const reply = await handleBotMessage(text.toLowerCase().trim());
  if (reply) await sendWhatsAppMessage(from, reply);

  return new Response("OK", { status: 200 });
}

async function handleBotMessage(text: string): Promise<string | null> {
  if (text === "help" || text === "hi" || text === "hello") {
    return buildHelpMessage();
  }

  if (text.startsWith("summary")) {
    return buildSummaryMessage(text);
  }

  if (text.startsWith("stock")) {
    return buildStockMessage(text.replace(/^stock\s*/i, "").trim());
  }

  if (text === "lowstock" || text === "low stock") {
    return buildLowStockMessage();
  }

  return (
    "I didn't understand that.\n\n" +
    "Try:\n• *stock samsung a54*\n• *summary today*\n• *lowstock*\n• *help*"
  );
}

async function buildHelpMessage(): Promise<string> {
  return (
    "🏪 *HM Stocks Bot*\n\n" +
    "Available commands:\n" +
    "• *stock [brand] [model]* — Check stock levels\n" +
    "• *summary today* — Today's sales summary\n" +
    "• *summary week* — This week's summary\n" +
    "• *summary month* — This month's summary\n" +
    "• *lowstock* — Items below threshold\n" +
    "• *help* — Show this message"
  );
}

async function buildStockMessage(query: string): Promise<string> {
  if (!query) {
    const total = await prisma.product.count({ where: { isActive: true } });
    const value = await prisma.product.aggregate({
      where: { isActive: true },
      _sum: { stockQty: true },
    });
    return `📦 *Stock Overview*\n\nTotal SKUs: ${total}\nTotal items: ${value._sum.stockQty ?? 0}`;
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { brand: { name: { contains: query, mode: "insensitive" } } },
        { model: { name: { contains: query, mode: "insensitive" } } },
        { name: { contains: query, mode: "insensitive" } },
        { partBrand: { name: { contains: query, mode: "insensitive" } } },
        { tags: { has: query } },
      ],
    },
    include: { brand: true, model: true, partBrand: true },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    take: 10,
  });

  if (products.length === 0) return `❌ No products found for "*${query}*"`;

  const lines = products.map((p) => {
    const isLow = p.stockQty <= p.lowStockThreshold;
    const flag = isLow ? " ⚠️" : "";
    const partSuffix = p.partBrand ? ` (${p.partBrand.name})` : "";
    return `• ${p.brand.name}${p.model ? ` ${p.model.name}` : ""} ${p.name}${partSuffix}: *${p.stockQty}* pcs${flag}`;
  });

  return `📦 *Stock: "${query}"*\n\n${lines.join("\n")}`;
}

async function buildSummaryMessage(text: string): Promise<string> {
  const now = new Date();
  let start: Date;
  let label: string;

  if (text.includes("week")) {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    start.setHours(0, 0, 0, 0);
    label = "This Week";
  } else if (text.includes("month")) {
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

  const date = now.toLocaleDateString("en-LK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    `📊 *HM Stocks — ${label} Summary*\n` +
    `_${date}_\n\n` +
    `💰 Revenue: LKR ${revenue.toLocaleString("en-LK")}\n` +
    `💸 Cost: LKR ${cost.toLocaleString("en-LK")}\n` +
    `📈 Profit: LKR ${profit.toLocaleString("en-LK")} (${margin}%)\n` +
    `🛒 Transactions: ${sales._count}\n` +
    (lowCount > 0 ? `⚠️ Low stock items: ${lowCount}` : "✅ All stock levels OK")
  );
}

async function buildLowStockMessage(): Promise<string> {
  const products = await prisma.$queryRaw<
    { name: string; stockQty: number; brandName: string; modelName: string | null }[]
  >`
    SELECT p.name, p."stockQty", b.name as "brandName", pm.name as "modelName"
    FROM "Product" p
    JOIN "Brand" b ON b.id = p."brandId"
    LEFT JOIN "PhoneModel" pm ON pm.id = p."modelId"
    WHERE p."isActive" = true AND p."stockQty" <= p."lowStockThreshold"
    ORDER BY p."stockQty" ASC
    LIMIT 15
  `;

  if (products.length === 0) {
    return "✅ *All stock levels are healthy!* No items below threshold.";
  }

  const lines = products.map(
    (p) =>
      `• ${p.brandName}${p.modelName ? ` ${p.modelName}` : ""} ${p.name}: *${p.stockQty}* left`
  );

  return `⚠️ *Low Stock Alert (${products.length} items)*\n\n${lines.join("\n")}`;
}

async function sendWhatsAppMessage(to: string, message: string) {
  const config = await prisma.whatsAppConfig.findFirst({ where: { isActive: true } });
  if (!config) return;

  const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message, preview_url: false },
    }),
  });

  await prisma.whatsAppLog.create({
    data: { direction: "OUT", from: "bot", to, message },
  });

  return res.ok;
}
