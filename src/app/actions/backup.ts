"use server";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage, sendTelegramDocument } from "@/lib/telegram";

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

export async function sendTelegramFileBackup(): Promise<BackupState> {
  await verifyRole(["ADMIN"]);

  const config = await prisma.telegramConfig.findFirst({ where: { isActive: true } });
  if (!config) return { error: "Telegram not configured. Set it up in the Telegram page first." };

  const [brands, categories, products, sales, movements] = await Promise.all([
    prisma.brand.findMany({ include: { models: true } }),
    prisma.category.findMany(),
    prisma.product.findMany({ include: { brand: true, model: true, category: true } }),
    prisma.sale.findMany({
      include: {
        seller: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.stockMovement.findMany({
      include: {
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    data: {
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        models: b.models.map((m) => ({ id: m.id, name: m.name })),
      })),
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand.name,
        model: p.model?.name ?? null,
        category: p.category.name,
        qualityGrade: p.qualityGrade,
        costPrice: p.costPrice.toNumber(),
        sellingPrice: p.sellingPrice.toNumber(),
        stockQty: p.stockQty,
        lowStockThreshold: p.lowStockThreshold,
        tags: p.tags,
        description: p.description,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
      })),
      sales: sales.map((s) => ({
        id: s.id,
        seller: s.seller.name,
        totalRevenue: s.totalRevenue.toNumber(),
        totalCost: s.totalCost.toNumber(),
        profit: s.profit.toNumber(),
        note: s.note,
        createdAt: s.createdAt.toISOString(),
        items: s.items.map((i) => ({
          product: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toNumber(),
          unitCost: i.unitCost.toNumber(),
        })),
      })),
      stockMovements: movements.map((m) => ({
        product: m.product.name,
        type: m.type,
        quantity: m.quantity,
        note: m.note,
        createdBy: m.createdBy.name,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `hm-stocks-backup-${date}.json`;
  const content = JSON.stringify(backup, null, 2);
  const caption = `📦 HM Stocks — Full backup\n_${date}_\n${products.length} products · ${sales.length} sales`;

  try {
    const ok = await sendTelegramDocument(config.botToken, config.chatId, filename, content, "application/json", caption);
    if (!ok) return { error: "Failed to send file to Telegram. Check your bot config." };
    return { success: `Backup file sent to Telegram: ${filename}` };
  } catch {
    return { error: "Could not reach Telegram." };
  }
}
