import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await verifySession();
  if (!["ADMIN", "OWNER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [brands, categories, products, sales, movements] = await Promise.all([
    prisma.brand.findMany({ include: { models: true } }),
    prisma.category.findMany(),
    prisma.product.findMany({
      include: { brand: true, model: true, category: true },
    }),
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

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="hm-stocks-backup-${date}.json"`,
    },
  });
}
