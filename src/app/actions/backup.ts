"use server";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

export type BackupState = { error?: string; success?: string } | undefined;

export async function sendTelegramBackup(): Promise<BackupState> {
  await verifyRole(["ADMIN"]);

  const config = await prisma.telegramConfig.findFirst({ where: { isActive: true } });
  if (!config) return { error: "Telegram not configured. Set it up in the Telegram page first." };

  const [productStats, salesStats, lowStock, recentSales] = await Promise.all([
    prisma.product.aggregate({
      where: { isActive: true },
      _count: true,
      _sum: { stockQty: true },
    }),
    prisma.sale.aggregate({
      _count: true,
      _sum: { totalRevenue: true, profit: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Product"
      WHERE "isActive" = true AND "stockQty" <= "lowStockThreshold"
    `,
    prisma.sale.aggregate({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _count: true,
      _sum: { totalRevenue: true, profit: true },
    }),
  ]);

  const totalRevenue = Number(salesStats._sum.totalRevenue ?? 0);
  const totalProfit = Number(salesStats._sum.profit ?? 0);
  const todayRevenue = Number(recentSales._sum.totalRevenue ?? 0);
  const todayProfit = Number(recentSales._sum.profit ?? 0);
  const lowCount = Number(lowStock[0]?.count ?? 0);
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
  const date = new Date().toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" });

  const message =
    `🗄️ *HM Stocks — Backup Summary*\n` +
    `_${date}_\n\n` +
    `📦 *Inventory*\n` +
    `• Active products: ${productStats._count}\n` +
    `• Total items in stock: ${productStats._sum.stockQty ?? 0}\n` +
    `• Low stock alerts: ${lowCount > 0 ? `⚠️ ${lowCount}` : "✅ None"}\n\n` +
    `📊 *All-time Sales*\n` +
    `• Total transactions: ${salesStats._count}\n` +
    `• Total revenue: ${fmt(totalRevenue)}\n` +
    `• Total profit: ${fmt(totalProfit)}\n\n` +
    `📅 *Today*\n` +
    `• Transactions: ${recentSales._count}\n` +
    `• Revenue: ${fmt(todayRevenue)}\n` +
    `• Profit: ${fmt(todayProfit)}\n\n` +
    `_Download full backup from the app: Settings → Backup_`;

  try {
    const ok = await sendTelegramMessage(config.botToken, config.chatId, message);
    if (!ok) return { error: "Failed to send to Telegram. Check your bot config." };
    return { success: "Backup summary sent to Telegram." };
  } catch {
    return { error: "Could not reach Telegram." };
  }
}
