import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const DEACTIVATED_MSG =
  `🚫 *HM Stocks — Service Inactive*\n\n` +
  `Telegram access has been disabled.\n` +
  `Contact HM Stocks support to reactivate your license.`;

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
  const messageId: number = message.message_id;
  const text: string = (message.text ?? "").trim();

  await prisma.telegramLog.create({
    data: { direction: "IN", from: chatId, to: "bot", message: text },
  });

  // Direct DB check — bot is blocked if deactivated, trial not started, or expired
  const licenseRow = await prisma.appLicense.findFirst();
  const now = new Date();
  const blocked =
    !licenseRow ||
    licenseRow.forceDeactivated ||
    licenseRow.licensedUntil?.getTime() === 0 ||
    (!licenseRow.trialStartedAt && !licenseRow.licensedUntil);

  if (!blocked && licenseRow) {
    const { addMonths } = await import("date-fns");
    const trialEnd = licenseRow.trialStartedAt ? addMonths(licenseRow.trialStartedAt, 4) : now;
    const expiresAt =
      licenseRow.licensedUntil && licenseRow.licensedUntil > trialEnd
        ? licenseRow.licensedUntil
        : trialEnd;
    if (now >= expiresAt) {
      await sendTelegramMessage(config.botToken, chatId, DEACTIVATED_MSG);
      return new Response("OK", { status: 200 });
    }
  }

  if (blocked) {
    await sendTelegramMessage(config.botToken, chatId, DEACTIVATED_MSG);
    return new Response("OK", { status: 200 });
  }

  const { reply, deleteInput } = await routeMessage(chatId, text, messageId, config.botToken);

  // Delete the user's password message for security
  if (deleteInput) {
    await deleteTelegramMessage(config.botToken, chatId, messageId).catch(() => {});
  }

  if (reply) {
    await sendTelegramMessage(config.botToken, chatId, reply);
    await prisma.telegramLog.create({
      data: { direction: "OUT", from: "bot", to: chatId, message: reply },
    });
  }

  return new Response("OK", { status: 200 });
}

async function routeMessage(
  chatId: string,
  text: string,
  _messageId: number,
  _botToken: string
): Promise<{ reply: string | null; deleteInput: boolean }> {
  const now = new Date();
  const session = await prisma.telegramSession.findUnique({ where: { chatId } });
  const isAuthenticated = !!session && session.expiresAt > now;

  // Logout
  if (text === "/logout" || text.toLowerCase() === "logout") {
    if (session) await prisma.telegramSession.delete({ where: { chatId } });
    return { reply: "👋 Logged out. Send your password to log in again.", deleteInput: false };
  }

  if (!isAuthenticated) {
    if (["/start", "/help"].includes(text.toLowerCase())) {
      return { reply: "🔐 *HM Stocks Bot*\n\nEnter your login password to continue:", deleteInput: false };
    }
    if (!text.startsWith("/") && text.length >= 4) {
      const reply = await tryAuthenticate(chatId, text, now);
      return { reply, deleteInput: true };
    }
    return { reply: "🔐 *HM Stocks Bot*\n\nEnter your login password to continue:", deleteInput: false };
  }

  // Refresh session on every message
  await prisma.telegramSession.update({
    where: { chatId },
    data: { expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
  });

  const canViewFinancials = session.role === "OWNER" || session.role === "ADMIN";
  const reply = await handleBotMessage(text, canViewFinancials);
  return { reply, deleteInput: false };
}

async function tryAuthenticate(chatId: string, password: string, now: Date): Promise<string> {
  const users = await prisma.user.findMany({ where: { isActive: true } });

  let matchedUser = null;
  for (const user of users) {
    if (await bcrypt.compare(password, user.password)) {
      matchedUser = user;
      break;
    }
  }

  if (!matchedUser) {
    return "❌ Wrong password. Try again:";
  }

  await prisma.telegramSession.upsert({
    where: { chatId },
    create: {
      chatId,
      userId: matchedUser.id,
      role: matchedUser.role,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
    update: {
      userId: matchedUser.id,
      role: matchedUser.role,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
  });

  const canViewFinancials = matchedUser.role === "OWNER" || matchedUser.role === "ADMIN";
  const commands = canViewFinancials
    ? "• *today / week / month* — sales summary\n• *stock* — overview\n• *stock samsung* — search\n• *low* — low stock\n• *logout* — sign out"
    : "• *stock* — stock overview\n• *stock samsung* — search\n• *low* — low stock items\n• *logout* — sign out";

  return (
    `✅ *Welcome, ${matchedUser.name}!*\n` +
    `Role: ${matchedUser.role}\n` +
    `Session active for 24 hours.\n\n` +
    `Available commands:\n${commands}`
  );
}

async function deleteTelegramMessage(token: string, chatId: string, messageId: number): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

async function handleBotMessage(text: string, canViewFinancials: boolean): Promise<string | null> {
  const t = text.toLowerCase();

  if (["/help", "help", "hi", "hello", "hey"].includes(t)) {
    return buildHelpMessage(canViewFinancials);
  }

  if (canViewFinancials) {
    if (["today", "/today", "t"].includes(t)) return buildSummaryMessage("today");
    if (["week", "/week", "w"].includes(t)) return buildSummaryMessage("week");
    if (["month", "/month", "m"].includes(t)) return buildSummaryMessage("month");
    if (t.startsWith("/summary") || t.startsWith("summary")) return buildSummaryMessage(t);
  } else if (["today", "/today", "week", "/week", "month", "/month", "t", "w", "m"].includes(t)) {
    return "🚫 Sales summaries are only available to Owner / Admin.";
  }

  if (["/lowstock", "lowstock", "low", "l"].includes(t)) return buildLowStockMessage();

  if (t === "/stock" || t === "stock" || t === "s") return buildStockMessage("");
  if (t.startsWith("/stock ")) return buildStockMessage(text.slice(7).trim());
  if (t.startsWith("stock ")) return buildStockMessage(text.slice(6).trim());
  if (t.startsWith("s ")) return buildStockMessage(text.slice(2).trim());

  if (t.length >= 2) return buildStockMessage(text.trim());

  return (
    "❓ I didn't get that.\n\n" +
    "Quick commands:\n" +
    "• *stock iphone* — search stock\n" +
    "• *low* — low stock items\n" +
    (canViewFinancials ? "• *today* — today's sales\n" : "") +
    "• *help* — all commands\n" +
    "• *logout* — sign out"
  );
}

function buildHelpMessage(canViewFinancials: boolean): string {
  return (
    "🏪 *HM Stocks Bot*\n\n" +
    (canViewFinancials
      ? "*Sales Summary*\n• today _(or /today, t)_\n• week _(or /week, w)_\n• month _(or /month, m)_\n\n"
      : "") +
    "*Stock*\n" +
    "• stock _(overview)_\n" +
    "• stock samsung _(search)_\n" +
    "• s iphone 14 _(short form)_\n\n" +
    "*Alerts*\n" +
    "• low _(or /lowstock)_\n\n" +
    "*Account*\n" +
    "• logout\n\n" +
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

  if (products.length === 0) return "✅ *All stock levels are healthy!*";

  const lines = products.map((p) => {
    const name = `${p.brandName}${p.modelName ? ` ${p.modelName}` : ""} ${p.name}`;
    const urgent = p.stockQty === 0 ? " 🔴 OUT" : "";
    return `• ${name}: *${p.stockQty}* left${urgent}`;
  });

  return `⚠️ *Low Stock — ${products.length} item${products.length > 1 ? "s" : ""}*\n\n${lines.join("\n")}`;
}
