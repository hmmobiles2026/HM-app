import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage, sendTelegramDocument } from "@/lib/telegram";
import { buildDailyReport } from "@/lib/daily-report";
import { getReceivablesSummary, getCustomerBalanceMap } from "@/lib/customers";
import { getLicenseStatus } from "@/lib/license";
import {
  searchTokens,
  tokenFilter,
  rankProducts,
  fitCount,
  SEARCH_SCAN,
} from "@/lib/stock-search";

const SESSION_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Escape special chars for Telegram old Markdown mode
function escapeMd(s: string): string {
  return s.replace(/[_*`[]/g, "\\$&");
}

// In-memory rate limiter for bot password attempts (per chatId)
const botAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes


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

  // Licence gate. Uses getLicenseStatus() rather than repeating the trial maths here —
  // the trial length used to be hardcoded in this file as well as in license.ts, so
  // changing one would silently disagree with the other.
  const license = await getLicenseStatus();
  if (!license.active) {
    // Say WHY. This used to return silently, so on the day a licence lapsed the bot
    // simply stopped answering and the shop had no idea what had happened.
    const reason = license.forceDeactivated
      ? `🔒 *HM Stocks bot is deactivated.*\n\nPlease contact HM Stocks support to reactivate.`
      : license.trialNotStarted
        ? `🔒 *HM Stocks bot is not activated yet.*\n\nAn admin needs to start the free trial in Settings → License.`
        : `🔒 *HM Stocks license has expired.*\n\nThe bot cannot answer until it is renewed. Contact HM Stocks support — LKR 2,000 for 3 months.`;

    await sendTelegramMessage(config.botToken, chatId, reason, "Markdown").catch(() => {});
    await prisma.telegramLog
      .create({ data: { direction: "OUT", from: "bot", to: chatId, message: reason } })
      .catch(() => {});
    return new Response("OK", { status: 200 });
  }

  const { reply, deleteInput } = await routeMessage(chatId, text, messageId, config.botToken);

  // Delete the user's password message for security
  if (deleteInput) {
    await deleteTelegramMessage(config.botToken, chatId, messageId).catch(() => {});
  }

  if (reply) {
    await sendTelegramMessage(config.botToken, chatId, reply, "Markdown");
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
  botToken: string
): Promise<{ reply: string | null; deleteInput: boolean }> {
  const now = new Date();
  const session = await prisma.telegramSession.findUnique({ where: { chatId } });
  const isAuthenticated = !!session && session.expiresAt > now;

  // Logout
  if (text === "/logout" || text.toLowerCase() === "logout") {
    if (session) await prisma.telegramSession.delete({ where: { chatId } });
    return { reply: "👋 Logged out. Send your password to log in again.", deleteInput: false };
  }

  const sessionExpired = !!session && session.expiresAt <= now;

  if (!isAuthenticated) {
    // Match greetings with or without a slash. "help" and "hello" used to fall through
    // to the password check and burn one of the five attempts before lockout.
    const greeting = (text.trim().startsWith("/") ? text.trim().slice(1) : text.trim()).toLowerCase();
    if (["start", "help", "hi", "hello", "hey"].includes(greeting)) {
      return { reply: "🔐 *HM Stocks Bot*\n\nEnter your login password to continue:", deleteInput: false };
    }
    if (!text.startsWith("/") && text.length >= 4) {
      const reply = await tryAuthenticate(chatId, text, now);
      return { reply, deleteInput: true };
    }
    const prompt = sessionExpired
      ? "🔒 *Session expired.* Send your password to log in again:"
      : "🔐 *HM Stocks Bot*\n\nEnter your login password to continue:";
    return { reply: prompt, deleteInput: false };
  }

  const canViewFinancials = session.role === "OWNER" || session.role === "ADMIN";
  const reply = await handleBotMessage(text, canViewFinancials, session.role, botToken, chatId);
  return { reply, deleteInput: false };
}

async function tryAuthenticate(chatId: string, password: string, now: Date): Promise<string> {
  const ts = now.getTime();
  const limiter = botAttempts.get(chatId) ?? { count: 0, blockedUntil: 0 };
  if (ts < limiter.blockedUntil) {
    const mins = Math.ceil((limiter.blockedUntil - ts) / 60000);
    return `🔒 Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`;
  }

  const users = await prisma.user.findMany({ where: { isActive: true } });

  let matchedUser = null;
  for (const user of users) {
    if (await bcrypt.compare(password, user.password)) {
      matchedUser = user;
      break;
    }
  }

  if (!matchedUser) {
    const newCount = limiter.count + 1;
    if (newCount >= MAX_ATTEMPTS) {
      botAttempts.set(chatId, { count: 0, blockedUntil: ts + BLOCK_MS });
      return `🔒 Too many failed attempts. Try again in 15 minutes.`;
    }
    botAttempts.set(chatId, { count: newCount, blockedUntil: 0 });
    return `❌ Wrong password. Try again:`;
  }

  botAttempts.delete(chatId);

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
    `✅ *Welcome, ${escapeMd(matchedUser.name)}!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Role: ${roleLabel[matchedUser.role] ?? matchedUser.role}\n` +
    `🔒 Session valid for 2 days\n\n` +
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

async function handleBotMessage(
  text: string,
  canViewFinancials: boolean,
  role: string,
  botToken: string,
  chatId: string
): Promise<string | null> {
  // Telegram's own UI pushes people towards a leading slash, but only some commands
  // listed one. "/low", "/sup", "/t" and "/bk" fell through to a stock search for
  // their own text and answered "nothing found". Strip it once, accept both forms.
  const bare = text.trim().startsWith("/") ? text.trim().slice(1) : text.trim();
  const t = bare.toLowerCase();

  if (["start", "help", "hi", "hello", "hey"].includes(t)) {
    return buildHelpMessage(canViewFinancials);
  }

  if (canViewFinancials) {
    if (["today", "t"].includes(t)) return buildSummaryMessage("today");
    if (["week", "w"].includes(t)) return buildSummaryMessage("week");
    if (["month", "m"].includes(t)) return buildSummaryMessage("month");
    if (t.startsWith("summary")) return buildSummaryMessage(t);
    if (["report", "r"].includes(t)) return buildDailyReport();
    if (["backup", "bk"].includes(t)) {
      if (role === "ADMIN") {
        await sendFullBackupFile(botToken, chatId);
        return null; // file already sent
      }
      return await buildBackupSummary();
    }
  } else if (["today", "week", "month", "t", "w", "m", "report", "r", "backup", "bk"].includes(t)) {
    return "🚫 Sales summaries are only available to Owner / Admin.";
  }

  if (["lowstock", "low", "l"].includes(t)) return buildLowStockMessage(canViewFinancials);

  if (canViewFinancials && ["suppliers", "sup"].includes(t)) return buildSupplierReturnsMessage();
  else if (!canViewFinancials && ["suppliers", "sup"].includes(t))
    return "🚫 Supplier returns are only available to Owner / Admin.";

  if (["dues", "credit"].includes(t)) {
    if (!canViewFinancials) return "🚫 Customer dues are only available to Owner / Admin.";
    return buildDuesMessage();
  }

  // price/p is now just an alias for stock search (prices always shown)
  if (t.startsWith("price ") || t.startsWith("p "))
    return buildStockMessage(bare.replace(/^(price|p)\s+/i, "").trim(), canViewFinancials);

  if (t === "stock" || t === "s") return buildStockMessage("", canViewFinancials);
  if (t.startsWith("stock ")) return buildStockMessage(bare.slice(6).trim(), canViewFinancials);
  if (t.startsWith("s ")) return buildStockMessage(bare.slice(2).trim(), canViewFinancials);

  if (t.length >= 2) return buildStockMessage(bare.trim(), canViewFinancials);

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
  // Search comes first: it is what the bot is used for all day.
  const search =
    `🔍 *Find a part*\n` +
    `• *a06* — type any brand, model or part name\n` +
    `• *samsung a06* — two words narrows it down\n` +
    `• *stock* · *s* — overall stock snapshot\n` +
    (canViewFinancials
      ? `_Results show cost, price and margin._\n`
      : `_Results show price and quantity._\n`) +
    `_🟢 in stock · 🟡 running low · 🔴 out of stock_\n\n`;

  const alerts =
    `⚠️ *Alerts*\n` +
    `• *low* · *l* — items at or below reorder level\n\n`;

  const ownerOnly = canViewFinancials
    ? `📊 *Sales*\n` +
      `• *today* · *t* — today's revenue and profit\n` +
      `• *week* · *w* — this week (Fri–Thu)\n` +
      `• *month* · *m* — this month\n` +
      `• *report* · *r* — full daily report\n\n` +
      `🧾 *Customer credit*\n` +
      `• *dues* · *credit* — who owes money, with phone numbers\n\n` +
      `🚚 *Supplier returns*\n` +
      `• *suppliers* · *sup* — pending and resolved claims\n\n` +
      `💾 *Backup*\n` +
      `• *backup* · *bk* — snapshot (Admin gets the full file)\n\n`
    : `_Sales figures, dues and supplier claims are shown to Owner and Admin only._\n\n`;

  return (
    `🏪 *HM Stocks Bot*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    search +
    alerts +
    ownerOnly +
    `⚙️ *General*\n` +
    `• *help* — this list\n` +
    `• *logout* — sign out (you stay signed in 2 days)`
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

  const tokens = searchTokens(query);
  const safeQuery = escapeMd(query);
  const select = {
    include: { brand: true, model: true, partBrand: true },
    take: SEARCH_SCAN,
  };

  // Every word must match. "iphone 17" needs brand iPhone AND model 17; matching the
  // whole phrase against one field found nothing, because they are separate columns.
  let matches = await prisma.product.findMany({
    where: { isActive: true, AND: tokens.map(tokenFilter) },
    ...select,
  });
  let total = await prisma.product.count({
    where: { isActive: true, AND: tokens.map(tokenFilter) },
  });
  let loosened = false;

  // Nothing matched every word — show the closest instead of a dead end, and say so.
  if (matches.length === 0 && tokens.length > 1) {
    loosened = true;
    matches = await prisma.product.findMany({
      where: { isActive: true, OR: tokens.map(tokenFilter) },
      ...select,
    });
    total = await prisma.product.count({
      where: { isActive: true, OR: tokens.map(tokenFilter) },
    });
  }

  if (matches.length === 0) {
    return (
      `❌ *Nothing found for "${safeQuery}"*\n\n` +
      `Try a brand, model, part name or part brand — for example *samsung a06* or *iphone 17*.`
    );
  }

  const ordered = rankProducts(matches, query, tokens);

  const allLines = ordered.map((p) => {
    const partSuffix = p.partBrand ? ` (${escapeMd(p.partBrand.name)})` : "";
    const name = `${escapeMd(p.brand.name)}${p.model ? ` ${escapeMd(p.model.name)}` : ""} ${escapeMd(p.name)}${partSuffix}`;
    const sell = Number(p.sellingPrice);
    const cost = Number(p.costPrice);
    const margin = sell > 0 ? (((sell - cost) / sell) * 100).toFixed(0) : "0";
    const icon = p.stockQty === 0 ? "🔴" : p.stockQty <= p.lowStockThreshold ? "🟡" : "🟢";

    if (canViewCosts) {
      return (
        `${icon} *${name}*\n` +
        `   📦 ${p.stockQty} pcs  |  Cost: ${fmt(cost)}  →  Price: *${fmt(sell)}*  _(${margin}%)_`
      );
    }
    return `${icon} *${name}*\n   📦 ${p.stockQty} pcs  |  Price: *${fmt(sell)}*`;
  });

  // Show as many as the message can carry, best matches first.
  const shownCount = fitCount(allLines);
  const lines = allLines.slice(0, shownCount);

  // Always say how many exist. Silently truncating is what made stock look missing.
  const header = loosened
    ? `🔍 *"${safeQuery}"* — no exact match\nClosest ${lines.length} of ${total}:`
    : total > lines.length
      ? `🔍 *"${safeQuery}"* — showing ${lines.length} of ${total}`
      : `🔍 *"${safeQuery}"* — ${total} result${total > 1 ? "s" : ""}`;

  const more =
    total > lines.length
      ? `\n\n_Add a brand or model to narrow it down, e.g. *samsung a06*_`
      : "";

  return `${header}\n━━━━━━━━━━━━━━━━━━━━\n\n` + lines.join("\n\n") + more;
}

async function buildSummaryMessage(text: string): Promise<string> {
  const now = new Date();
  let start: Date;
  let label: string;

  if (text.includes("week") || text === "w") {
    // Week starts Friday 00:00 Sri Lanka time (UTC+5:30 = Thursday 18:30 UTC)
    const SL_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowSL = new Date(now.getTime() + SL_OFFSET);
    const slDay = nowSL.getUTCDay(); // 0=Sun … 5=Fri, 6=Sat
    const daysSinceFriday = (slDay - 5 + 7) % 7;
    const fridaySL = new Date(nowSL);
    fridaySL.setUTCDate(nowSL.getUTCDate() - daysSinceFriday);
    fridaySL.setUTCHours(0, 0, 0, 0);
    start = new Date(fridaySL.getTime() - SL_OFFSET);
    label = "This Week (Fri–Thu)";
  } else if (text.includes("month") || text === "m") {
    const slNow = new Date(now.getTime() + SL_OFFSET_MS);
    start = new Date(Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), 1) - SL_OFFSET_MS);
    label = "This Month";
  } else {
    const slNow = new Date(now.getTime() + SL_OFFSET_MS);
    start = new Date(Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - SL_OFFSET_MS);
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
  }).then((all) => all.filter((p) => p.stockQty <= p.lowStockThreshold).slice(0, 15));

  if (products.length === 0) {
    return `✅ *All stock levels are healthy!*`;
  }

  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
  const lines = products.map((p) => {
    const partSuffix = p.partBrand ? ` (${escapeMd(p.partBrand.name)})` : "";
    const name = `${escapeMd(p.brand.name)}${p.model ? ` ${escapeMd(p.model.name)}` : ""} ${escapeMd(p.name)}${partSuffix}`;
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

async function buildDuesMessage(): Promise<string> {
  const [summary, customers, balances] = await Promise.all([
    getReceivablesSummary(),
    prisma.customer.findMany({ select: { id: true, shopName: true, phone: true } }),
    getCustomerBalanceMap(),
  ]);

  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

  const owing = customers
    .map((c) => ({ ...c, balance: balances.get(c.id) ?? 0 }))
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  if (owing.length === 0) {
    return (
      `🧾 *Customer Credit*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ Every shop is settled up.\n\n` +
      (summary.collectedThisMonth > 0
        ? `💰 Collected this month: *${fmt(summary.collectedThisMonth)}*`
        : "")
    );
  }

  let msg =
    `🧾 *Customer Credit*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💵 Outstanding: *${fmt(summary.totalOutstanding)}*\n` +
    `🏪 Shops owing: ${owing.length}\n`;
  if (summary.overdue30 > 0) msg += `⏳ Over 30 days: *${fmt(summary.overdue30)}*\n`;
  if (summary.collectedThisMonth > 0)
    msg += `💰 Collected this month: ${fmt(summary.collectedThisMonth)}\n`;

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const c of owing.slice(0, 15)) {
    msg += `🔸 *${escapeMd(c.shopName)}* — ${fmt(c.balance)}\n`;
    if (c.phone) msg += `   ${escapeMd(c.phone)}\n`;
  }
  if (owing.length > 15) msg += `\n_...and ${owing.length - 15} more_`;

  return msg;
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
      const label = [p.brand.name, p.model?.name, p.name].filter((s): s is string => !!s).map(escapeMd).join(" ");
      msg += `🔸 *${label}*\n   Qty: ${r.quantity}  |  Claim: ${fmt(Number(r.costRecovery ?? 0))}\n   Supplier: ${escapeMd(r.supplier?.name ?? "—")}\n   Reason: ${escapeMd(r.reason)}\n\n`;
    }
  }

  if (resolved.length > 0) {
    msg += `✅ *Resolved (${resolved.length})*\n\n`;
    for (const r of resolved) {
      const p = r.saleItem.product;
      const label = [p.brand.name, p.model?.name, p.name].filter((s): s is string => !!s).map(escapeMd).join(" ");
      msg += `✔️ ${label} × ${r.quantity} — ${escapeMd(r.supplier?.name ?? "—")}\n`;
    }
  }

  return msg.trim();
}

async function sendFullBackupFile(botToken: string, chatId: string): Promise<void> {
  const [brands, categories, products, sales, suppliers] = await Promise.all([
    prisma.brand.findMany({ include: { models: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ include: { partBrands: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      include: { brand: true, model: true, category: true, partBrand: true, supplier: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sale.findMany({
      include: { seller: { select: { name: true } }, items: { include: { product: { select: { name: true } }, returns: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    brands,
    categories,
    products: products.map((p) => ({ ...p, costPrice: p.costPrice.toString(), sellingPrice: p.sellingPrice.toString() })),
    sales: sales.map((s) => ({
      ...s,
      totalRevenue: s.totalRevenue.toString(),
      totalCost: s.totalCost.toString(),
      profit: s.profit.toString(),
      items: s.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toString(), unitCost: i.unitCost.toString() })),
    })),
    suppliers,
  };

  const date = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(backup, null, 2);
  await sendTelegramDocument(botToken, chatId, `HM-Stocks-Backup-${date}.json`, json, "application/json", `📦 Full backup — ${date}`);
}

async function buildBackupSummary(): Promise<string> {
  const SL_OFFSET = 5.5 * 60 * 60 * 1000;
  const now = new Date();
  const todayStartSL = new Date(now.getTime() + SL_OFFSET);
  todayStartSL.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(todayStartSL.getTime() - SL_OFFSET);

  const [productCount, stockTotal, lowCount, todaySales, pendingReturns] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.aggregate({ where: { isActive: true }, _sum: { stockQty: true } }),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Product" WHERE "isActive" = true AND "stockQty" <= "lowStockThreshold"`,
    prisma.sale.aggregate({ where: { createdAt: { gte: todayStart } }, _sum: { totalRevenue: true, profit: true }, _count: { id: true } }),
    prisma.saleReturn.count({ where: { returnType: "SUPPLIER_RETURN", supplierStatus: "PENDING" } }),
  ]);

  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
  const sl = new Date(now.getTime() + SL_OFFSET);
  const dateStr = `${String(sl.getUTCDate()).padStart(2, "0")}/${String(sl.getUTCMonth() + 1).padStart(2, "0")}/${sl.getUTCFullYear()}`;

  return (
    `📊 *Business Snapshot — ${dateStr}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📦 *Inventory*\n` +
    `• SKUs: *${productCount}*\n` +
    `• Total items: *${stockTotal._sum.stockQty ?? 0}*\n` +
    `• Low stock alerts: *${Number(lowCount[0]?.count ?? 0)}*\n\n` +
    `💰 *Today's Sales*\n` +
    `• Transactions: *${todaySales._count.id}*\n` +
    `• Revenue: *${fmt(Number(todaySales._sum.totalRevenue ?? 0))}*\n` +
    `• Profit: *${fmt(Number(todaySales._sum.profit ?? 0))}*\n\n` +
    (pendingReturns > 0 ? `⚠️ *${pendingReturns} pending supplier return${pendingReturns > 1 ? "s" : ""}*\n\n` : ``) +
    `_Full file backup available to Admin only_`
  );
}
