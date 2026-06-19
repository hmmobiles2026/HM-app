import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { buildDailyReport } from "@/lib/daily-report";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;


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
      return new Response("OK", { status: 200 });
    }
  }

  if (blocked) {
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

  const roleLabel: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", SELLER: "Seller" };
  return (
    `✅ *Welcome, ${matchedUser.name}!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Role: ${roleLabel[matchedUser.role] ?? matchedUser.role}\n` +
    `🔒 Session valid for 24 hours\n\n` +
    `Type *help* to see available commands.`
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

  if (["/start", "/help", "help", "hi", "hello", "hey"].includes(t)) {
    return buildHelpMessage(canViewFinancials);
  }

  if (canViewFinancials) {
    if (["today", "/today", "t"].includes(t)) return buildSummaryMessage("today");
    if (["week", "/week", "w"].includes(t)) return buildSummaryMessage("week");
    if (["month", "/month", "m"].includes(t)) return buildSummaryMessage("month");
    if (t.startsWith("/summary") || t.startsWith("summary")) return buildSummaryMessage(t);
    if (["report", "/report", "r"].includes(t)) return buildDailyReport();
  } else if (["today", "/today", "week", "/week", "month", "/month", "t", "w", "m", "report", "/report", "r"].includes(t)) {
    return "🚫 Sales summaries are only available to Owner / Admin.";
  }

  if (["/lowstock", "lowstock", "low", "l"].includes(t)) return buildLowStockMessage(canViewFinancials);

  if (canViewFinancials && ["/suppliers", "suppliers", "sup"].includes(t)) return buildSupplierReturnsMessage();
  else if (!canViewFinancials && ["/suppliers", "suppliers", "sup"].includes(t))
    return "🚫 Supplier returns are only available to Owner / Admin.";

  // price/p is now just an alias for stock search (prices always shown)
  if (t.startsWith("price ") || t.startsWith("/price ") || t.startsWith("p "))
    return buildStockMessage(text.replace(/^\/?(price|p)\s+/i, "").trim(), canViewFinancials);

  if (t === "/stock" || t === "stock" || t === "s") return buildStockMessage("", canViewFinancials);
  if (t.startsWith("/stock ")) return buildStockMessage(text.slice(7).trim(), canViewFinancials);
  if (t.startsWith("stock ")) return buildStockMessage(text.slice(6).trim(), canViewFinancials);
  if (t.startsWith("s ")) return buildStockMessage(text.slice(2).trim(), canViewFinancials);

  if (t.length >= 2) return buildStockMessage(text.trim(), canViewFinancials);

  return (
    `❓ *Not sure what you meant.*\n\n` +
    `Quick commands:\n` +
    `• *a14* — search stock + prices\n` +
    `• *low* — low stock items\n` +
    (canViewFinancials ? `• *today* — today's sales\n• *report* — full daily report\n` : ``) +
    `• *help* — all commands\n` +
    `• *logout* — sign out`
  );
}

function buildHelpMessage(canViewFinancials: boolean): string {
  const salesSection = canViewFinancials
    ? `📊 *Sales*\n` +
      `• report · r — _Full today's report (sales + low stock)_\n` +
      `• today · t — _Quick today's totals_\n` +
      `• week · w — _This week's totals_\n` +
      `• month · m — _This month's totals_\n\n` +
      `🚚 *Supplier Returns*\n` +
      `• suppliers · sup — _Pending & resolved supplier claims_\n\n`
    : "";

  const priceNote = canViewFinancials
    ? `_Search shows cost, selling price & margin_\n\n`
    : `_Search shows selling price & stock count_\n\n`;

  return (
    `🏪 *HM Stocks Bot*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    salesSection +
    `📦 *Stock & Prices*\n` +
    `• a14 samsung — _Search by brand, model, or part name_\n` +
    `• stock · s — _Overall inventory snapshot_\n` +
    priceNote +
    `⚠️ *Alerts*\n` +
    `• low · l — _Items at or below their reorder level_\n\n` +
    `⚙️ *General*\n` +
    `• help — _This command list_\n` +
    `• logout — _Sign out_`
  );
}

async function buildStockMessage(query: string, canViewCosts: boolean): Promise<string> {
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

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
      `📦 *Stock Overview*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 SKUs: *${total}*\n` +
      `🔢 Total items: *${value._sum.stockQty ?? 0}*\n\n` +
      (low > 0 ? `⚠️ Low stock: *${low}* item${low > 1 ? "s" : ""}` : `✅ All stock levels healthy`)
    );
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { brand: { name: { contains: query, mode: "insensitive" } } },
        { model: { name: { contains: query, mode: "insensitive" } } },
        { name: { contains: query, mode: "insensitive" } },
        { partBrand: { name: { contains: query, mode: "insensitive" } } },
        { tags: { has: query.toLowerCase() } },
      ],
    },
    include: { brand: true, model: true, partBrand: true },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    take: 10,
  });

  if (products.length === 0) {
    return `❌ *Nothing found for "${query}"*\n\nTry searching by brand, model, part name, or part brand.`;
  }

  const lines = products.map((p) => {
    const partSuffix = p.partBrand ? ` (${p.partBrand.name})` : "";
    const name = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} ${p.name}${partSuffix}`;
    const sell = Number(p.sellingPrice);
    const cost = Number(p.costPrice);
    const margin = sell > 0 ? ((sell - cost) / sell * 100).toFixed(0) : "0";
    const icon = p.stockQty === 0 ? "🔴" : p.stockQty <= p.lowStockThreshold ? "🟡" : "🟢";

    if (canViewCosts) {
      return (
        `${icon} *${name}*\n` +
        `   📦 ${p.stockQty} pcs  |  Cost: ${fmt(cost)}  →  Price: *${fmt(sell)}*  _(${margin}%)_`
      );
    }
    return `${icon} *${name}*\n   📦 ${p.stockQty} pcs  |  Price: *${fmt(sell)}*`;
  });

  return (
    `🔍 *"${query}"*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join("\n\n") +
    (products.length === 10 ? "\n\n_Showing top 10 results_" : "")
  );
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
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0.0";
  const lowCount = Number(lowStock[0]?.count ?? 0);
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

  if (sales._count === 0) {
    return (
      `📊 *${label} Summary*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `_No sales recorded._\n\n` +
      (lowCount > 0 ? `⚠️ ${lowCount} item${lowCount > 1 ? "s" : ""} low on stock` : `✅ Stock levels OK`)
    );
  }

  return (
    `📊 *${label} Summary*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💵 Revenue:  *${fmt(revenue)}*\n` +
    `📦 Cost:     ${fmt(cost)}\n` +
    `✅ Profit:   *${fmt(profit)}*  _(${margin}%)_\n` +
    `🛒 Sales:    ${sales._count} transaction${sales._count > 1 ? "s" : ""}\n\n` +
    (lowCount > 0 ? `⚠️ ${lowCount} item${lowCount > 1 ? "s" : ""} low on stock` : `✅ Stock levels OK`)
  );
}

async function buildLowStockMessage(canViewCosts: boolean): Promise<string> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { brand: true, model: true, partBrand: true },
    orderBy: { stockQty: "asc" },
    take: 15,
  }).then((all) => all.filter((p) => p.stockQty <= p.lowStockThreshold));

  if (products.length === 0) {
    return `✅ *All stock levels are healthy!*`;
  }

  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
  const lines = products.map((p) => {
    const partSuffix = p.partBrand ? ` (${p.partBrand.name})` : "";
    const name = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} ${p.name}${partSuffix}`;
    const icon = p.stockQty === 0 ? "🔴" : "🟡";
    const sell = Number(p.sellingPrice);
    const cost = Number(p.costPrice);
    const priceInfo = canViewCosts
      ? `Cost: ${fmt(cost)}  →  Price: *${fmt(sell)}*`
      : `Price: *${fmt(sell)}*`;
    return `${icon} *${name}*\n   📦 ${p.stockQty} left  |  ${priceInfo}`;
  });

  return (
    `⚠️ *Low Stock — ${products.length} item${products.length > 1 ? "s" : ""}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join("\n\n")
  );
}

async function buildSupplierReturnsMessage(): Promise<string> {
  const returns = await prisma.saleReturn.findMany({
    where: { returnType: "SUPPLIER_RETURN" },
    include: {
      supplier: { select: { name: true } },
      saleItem: {
        include: {
          product: { select: { name: true, brand: { select: { name: true } }, model: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ supplierStatus: "asc" }, { createdAt: "desc" }],
  });

  if (returns.length === 0) return `📦 *No supplier returns recorded.*`;

  const pending = returns.filter((r) => r.supplierStatus === "PENDING");
  const resolved = returns.filter((r) => r.supplierStatus === "RESOLVED");
  const totalPending = pending.reduce((s, r) => s + Number(r.costRecovery ?? 0), 0);
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

  let msg = `🚚 *Supplier Returns*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (pending.length > 0) {
    msg += `⏳ *Pending (${pending.length}) — ${fmt(totalPending)} to recover*\n\n`;
    for (const r of pending) {
      const p = r.saleItem.product;
      const label = [p.brand.name, p.model?.name, p.name].filter(Boolean).join(" ");
      msg += `🔸 *${label}*\n   Qty: ${r.quantity}  |  Claim: ${fmt(Number(r.costRecovery ?? 0))}\n   Supplier: ${r.supplier?.name ?? "—"}\n   Reason: ${r.reason}\n\n`;
    }
  }

  if (resolved.length > 0) {
    msg += `✅ *Resolved (${resolved.length})*\n\n`;
    for (const r of resolved) {
      const p = r.saleItem.product;
      const label = [p.brand.name, p.model?.name, p.name].filter(Boolean).join(" ");
      msg += `✔️ ${label} × ${r.quantity} — ${r.supplier?.name ?? "—"}\n`;
    }
  }

  return msg.trim();
}
