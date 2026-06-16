import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage, sendTelegramDocument } from "@/lib/telegram";
import { getLicenseStatus } from "@/lib/license";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.telegramConfig.findFirst({ where: { isActive: true } });
  if (!config) {
    return NextResponse.json({ skipped: true, reason: "Telegram not configured" });
  }

  const license = await getLicenseStatus();

  const [brands, categories, products, sales, movements, users] = await Promise.all([
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
    prisma.user.findMany({ select: { name: true, username: true, role: true, isActive: true, createdAt: true } }),
  ]);

  const now = new Date();
  const slNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dateLabel = slNow.toLocaleDateString("en-LK", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

  const backup = {
    exportedAt: now.toISOString(),
    exportedAtSL: slNow.toISOString(),
    version: "1.0",
    source: "auto-backup",
    data: {
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        models: b.models.map((m) => ({ id: m.id, name: m.name })),
      })),
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      users: users.map((u) => ({
        name: u.name,
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      })),
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
        description: p.description ?? null,
        imageUrl: p.imageUrl ?? null,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
      })),
      sales: sales.map((s) => ({
        id: s.id,
        seller: s.seller.name,
        totalRevenue: s.totalRevenue.toNumber(),
        totalCost: s.totalCost.toNumber(),
        profit: s.profit.toNumber(),
        note: s.note ?? null,
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
        note: m.note ?? null,
        createdBy: m.createdBy.name,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  };

  const date = now.toISOString().slice(0, 10);
  const filename = `hm-stocks-backup-${date}.json`;
  const content = JSON.stringify(backup, null, 2);

  const totalRevenue = sales.reduce((s, x) => s + x.totalRevenue.toNumber(), 0);
  const totalProfit = sales.reduce((s, x) => s + x.profit.toNumber(), 0);
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

  const caption =
    `🗄️ *Auto Backup — HM Stocks*\n` +
    `📅 ${dateLabel}\n\n` +
    `📦 ${products.filter(p => p.isActive).length} products  |  🔢 ${sales.length} sales\n` +
    `💵 All-time revenue: ${fmt(totalRevenue)}\n` +
    `✅ All-time profit: ${fmt(totalProfit)}\n` +
    (license.daysLeft <= 7
      ? `\n⏳ License expires in ${license.daysLeft} day${license.daysLeft !== 1 ? "s" : ""}`
      : "");

  const ok = await sendTelegramDocument(config.botToken, config.chatId, filename, content, "application/json", caption);

  if (!ok) {
    await sendTelegramMessage(config.botToken, config.chatId,
      `⚠️ *Auto Backup Failed — HM Stocks*\n\n` +
      `Could not send backup file for ${dateLabel}.\n` +
      `Go to Settings → Backup to download manually.`
    );
    return NextResponse.json({ sent: false, error: "Telegram document upload failed" });
  }

  return NextResponse.json({ sent: true, products: products.length, sales: sales.length });
}
