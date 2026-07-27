import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type LowStockProduct = {
  name: string;
  stockQty: number;
  lowStockThreshold: number;
  brand: { name: string };
  model: { name: string } | null;
  partBrand?: { name: string } | null;
};

export async function notifyLowStock(products: LowStockProduct[]): Promise<void> {
  if (products.length === 0) return;

  const [license, config] = await Promise.all([
    getLicenseStatus(),
    prisma.telegramConfig.findFirst().catch(() => null),
  ]);
  if (!license.active || !config) return;

  const now = new Date().toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const lines = products.map((p) => {
    const partBrandSuffix = p.partBrand ? ` (${esc(p.partBrand.name)})` : "";
    const label = `${esc(p.brand.name)}${p.model ? ` ${esc(p.model.name)}` : ""} — ${esc(p.name)}${partBrandSuffix}`;
    if (p.stockQty === 0) {
      return `🔴 <b>OUT OF STOCK</b>\n📦 ${label}\n⚠️ Reorder immediately`;
    }
    const bar = "█".repeat(Math.min(p.stockQty, 5)) + "░".repeat(Math.max(0, 5 - p.stockQty));
    return `🟡 <b>${p.stockQty} unit${p.stockQty > 1 ? "s" : ""} left</b> <code>[${bar}]</code>\n📦 ${label}\n⚠️ Threshold: ${p.lowStockThreshold}`;
  });

  const text =
    `🚨 <b>LOW STOCK ALERT</b> — HM Stocks\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join("\n\n") +
    `\n\n━━━━━━━━━━━━━━━━━━━━\n🕐 <i>${now}</i>`;

  await sendTelegramMessage(config.botToken, config.chatId, text, "HTML").catch(() => {});
}

type StockInItem = {
  productName: string;
  brandName: string;
  modelName: string | null;
  partBrandName?: string | null;
  quantity: number;
  costPrice: number;
};

export async function notifyStockIn(
  items: StockInItem[],
  addedBy: string,
  note?: string | null
): Promise<void> {
  const [license, config] = await Promise.all([
    getLicenseStatus(),
    prisma.telegramConfig.findFirst().catch(() => null),
  ]);
  if (!license.active || !config) return;

  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
  const time = new Date().toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  let text: string;
  if (items.length === 1) {
    const it = items[0];
    const partSuffix = it.partBrandName ? ` (${esc(it.partBrandName)})` : "";
    const label = `${esc(it.brandName)}${it.modelName ? ` ${esc(it.modelName)}` : ""} ${esc(it.productName)}${partSuffix}`;
    text =
      `📦 <b>Stock In — HM Stocks</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧑 ${esc(addedBy)}\n` +
      `📱 ${label}\n` +
      `🔢 Qty: <b>${it.quantity}</b> units\n` +
      `💵 Cost: <b>${fmt(it.costPrice)}</b> each\n` +
      (note ? `📝 ${esc(note)}\n` : "") +
      `\n🕐 <i>${time}</i>`;
  } else {
    const lines = items.map((it) => {
      const partSuffix = it.partBrandName ? ` (${esc(it.partBrandName)})` : "";
      const label = `${esc(it.brandName)}${it.modelName ? ` ${esc(it.modelName)}` : ""} ${esc(it.productName)}${partSuffix}`;
      return `• ${label} × <b>${it.quantity}</b> @ ${fmt(it.costPrice)}`;
    }).join("\n");
    const totalUnits = items.reduce((s, it) => s + it.quantity, 0);
    text =
      `📦 <b>Bulk Stock In — HM Stocks</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧑 ${esc(addedBy)}\n` +
      `🔢 ${totalUnits} units across ${items.length} products\n\n` +
      lines + "\n" +
      (note ? `\n📝 ${esc(note)}\n` : "") +
      `\n🕐 <i>${time}</i>`;
  }

  await sendTelegramMessage(config.botToken, config.chatId, text, "HTML").catch(() => {});
}

type SaleNotifyItem = {
  productName: string;
  brandName: string;
  modelName: string | null;
  partBrandName?: string | null;
  quantity: number;
  unitPrice: number;
};

export async function notifySale(
  saleId: string,
  sellerName: string,
  items: SaleNotifyItem[],
  totalRevenue: number,
  profit: number,
  warrantyFee?: number | null
): Promise<void> {
  const [license, config] = await Promise.all([
    getLicenseStatus(),
    prisma.telegramConfig.findFirst().catch(() => null),
  ]);
  if (!license.active || !config) return;

  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
  const time = new Date().toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const itemLines = items.map((it) => {
    const partSuffix = it.partBrandName ? ` (${esc(it.partBrandName)})` : "";
    const label = `${esc(it.brandName)}${it.modelName ? ` ${esc(it.modelName)}` : ""} ${esc(it.productName)}${partSuffix}`;
    return `• ${label} × <b>${it.quantity}</b> @ ${fmt(it.unitPrice)}`;
  }).join("\n");

  const warrantyLine = warrantyFee && warrantyFee > 0
    ? `🛡 Warranty: <b>${fmt(warrantyFee)}</b>\n`
    : "";

  const text =
    `💰 <b>Sale — HM Stocks</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🧑 ${esc(sellerName)}\n` +
    `🆔 Ref: <code>#${saleId.slice(-8).toUpperCase()}</code>\n\n` +
    itemLines + "\n\n" +
    warrantyLine +
    `💵 Total: <b>${fmt(totalRevenue)}</b>\n` +
    `📈 Profit: <b>${fmt(profit)}</b>\n` +
    `\n🕐 <i>${time}</i>`;

  await sendTelegramMessage(config.botToken, config.chatId, text, "HTML").catch(() => {});
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" | "MarkdownV2" = "HTML"
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendTelegramDocument(
  token: string,
  chatId: string,
  filename: string,
  content: string,
  mimeType: string,
  caption?: string
): Promise<boolean> {
  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", new Blob([content], { type: mimeType }), filename);
    if (caption) form.append("caption", caption);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });
    return res.ok;
  } catch {
    return false;
  }
}
