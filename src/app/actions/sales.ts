"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { notifyLowStock, notifySale } from "@/lib/telegram";
import { after } from "next/server";

const SaleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

const CreateSaleSchema = z.object({
  items: z.array(SaleItemSchema).min(1),
  note: z.string().optional(),
});

export type SaleState = { error?: string } | undefined;

export async function createSale(
  _state: SaleState,
  formData: FormData
): Promise<SaleState> {
  const session = await verifySession();

  const rawItems: { productId: string; quantity: number }[] = [];
  const customPrices: Record<string, number> = {};
  const keys = [...new Set([...formData.keys()].filter((k) => k.startsWith("productId_")))];

  for (const key of keys) {
    const idx = key.replace("productId_", "");
    const productId = formData.get(`productId_${idx}`) as string;
    const quantity = Number(formData.get(`quantity_${idx}`));
    const priceVal = Number(formData.get(`price_${idx}`));
    if (productId && quantity > 0) {
      rawItems.push({ productId, quantity });
      if (priceVal > 0) customPrices[productId] = priceVal;
    }
  }

  // Deduplicate by productId (sum quantities) to prevent stock bypass
  const deduped = new Map<string, number>();
  for (const { productId, quantity } of rawItems) {
    deduped.set(productId, (deduped.get(productId) ?? 0) + quantity);
  }
  const deduplicatedItems = [...deduped.entries()].map(([productId, quantity]) => ({ productId, quantity }));

  const parsed = CreateSaleSchema.safeParse({
    items: deduplicatedItems,
    note: formData.get("note"),
  });

  if (!parsed.success || parsed.data.items.length === 0) {
    return { error: "Please add at least one item to the sale." };
  }

  const { items, note } = parsed.data;
  const warrantyFeeRaw = Number(formData.get("warrantyFee") ?? 0);
  const warrantyFee = warrantyFeeRaw >= 1 ? warrantyFeeRaw : 0;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
  });

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return { error: `Product not found.` };
    if (product.stockQty < item.quantity) {
      return { error: `Insufficient stock for ${product.name}. Available: ${product.stockQty}` };
    }
  }

  let totalRevenue = 0;
  let totalCost = 0;

  const saleItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const unitPrice = customPrices[item.productId] ?? Number(product.sellingPrice);
    const unitCost = Number(product.costPrice);
    totalRevenue += unitPrice * item.quantity;
    totalCost += unitCost * item.quantity;
    return { productId: item.productId, quantity: item.quantity, unitPrice, unitCost };
  });

  totalRevenue += warrantyFee;
  const profit = totalRevenue - totalCost;

  let saleId = "";
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        sellerId: session.userId,
        totalRevenue,
        totalCost,
        profit,
        warrantyFee: warrantyFee > 0 ? warrantyFee : null,
        note: note || null,
        items: { create: saleItems },
      },
    });
    saleId = sale.id;

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "OUT",
          quantity: item.quantity,
          note: `Sale #${sale.id.slice(-6)}`,
          userId: session.userId,
        },
      });
    }
  });

  after(async () => {
    const soldIds = items.map((i) => i.productId);
    const updated = await prisma.product.findMany({
      where: { id: { in: soldIds }, isActive: true },
      include: { brand: true, model: true, partBrand: true },
    });

    const lowStock = updated.filter((p) => p.stockQty <= p.lowStockThreshold);
    const notifyItems = saleItems.map((si) => {
      const p = updated.find((pr) => pr.id === si.productId)!;
      return {
        productName: p.name,
        brandName: p.brand.name,
        modelName: p.model?.name ?? null,
        partBrandName: p.partBrand?.name ?? null,
        quantity: si.quantity,
        unitPrice: si.unitPrice,
      };
    });

    await Promise.all([
      notifySale(saleId, session.name, notifyItems, totalRevenue, profit, warrantyFee || null),
      notifyLowStock(lowStock),
    ]);
  });

  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  redirect("/sales");
}
