import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";

type LowStockProduct = {
  name: string;
  stockQty: number;
  lowStockThreshold: number;
  brand: { name: string };
  model: { name: string } | null;
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
    const label = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}`;
    if (p.stockQty === 0) {
      return `🔴 *OUT OF STOCK*\n📦 ${label}\n⚠️ Reorder immediately`;
    }
    const bar = "█".repeat(Math.min(p.stockQty, 5)) + "░".repeat(Math.max(0, 5 - p.stockQty));
    return `🟡 *${p.stockQty} unit${p.stockQty > 1 ? "s" : ""} left* \`[${bar}]\`\n📦 ${label}\n⚠️ Threshold: ${p.lowStockThreshold}`;
  });

  const text =
    `🚨 *LOW STOCK ALERT* — HM Stocks\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines.join("\n\n") +
    `\n\n━━━━━━━━━━━━━━━━━━━━\n🕐 _${now}_`;

  await sendTelegramMessage(config.botToken, config.chatId, text).catch(() => {});
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
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
