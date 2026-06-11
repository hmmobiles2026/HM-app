import { prisma } from "@/lib/prisma";

type LowStockProduct = {
  name: string;
  stockQty: number;
  lowStockThreshold: number;
  brand: { name: string };
  model: { name: string } | null;
};

export async function notifyLowStock(products: LowStockProduct[]): Promise<void> {
  if (products.length === 0) return;

  const config = await prisma.telegramConfig.findFirst().catch(() => null);
  if (!config) return;

  const lines = products.map((p) => {
    const label = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""} — ${p.name}`;
    const status = p.stockQty === 0 ? "🔴 OUT OF STOCK" : `🟡 ${p.stockQty} left`;
    return `• ${label}\n  ${status} (threshold: ${p.lowStockThreshold})`;
  });

  const text =
    `⚠️ *Low Stock Alert*\n\n` +
    lines.join("\n\n") +
    `\n\n_${new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}_`;

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
