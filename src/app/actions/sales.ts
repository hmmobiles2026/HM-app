"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { notifyLowStock, notifySale } from "@/lib/telegram";
import { roundMoney } from "@/lib/credit-math";
import { warrantyUntilFrom } from "@/lib/warranty-math";
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
  // Warranty is chosen per cart line and keyed by product, exactly like customPrices.
  const warrantyByProduct: Record<string, { perUnit: number; months: number }> = {};
  const keys = [...new Set([...formData.keys()].filter((k) => k.startsWith("productId_")))];

  for (const key of keys) {
    const idx = key.replace("productId_", "");
    const productId = formData.get(`productId_${idx}`) as string;
    const quantity = Number(formData.get(`quantity_${idx}`));
    const priceVal = Number(formData.get(`price_${idx}`));
    const warrantyVal = Number(formData.get(`warranty_${idx}`) ?? 0);
    const warrantyMonthsVal = Number(formData.get(`warrantyMonths_${idx}`) ?? 0);
    if (productId && quantity > 0) {
      rawItems.push({ productId, quantity });
      if (priceVal > 0) customPrices[productId] = priceVal;
      if (warrantyVal > 0 && warrantyMonthsVal > 0) {
        warrantyByProduct[productId] = {
          perUnit: roundMoney(warrantyVal),
          months: Math.min(60, Math.max(1, Math.round(warrantyMonthsVal))),
        };
      }
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

  // Optional credit customer. Absent (a walk-in cash sale) is the default and behaves
  // exactly as it always has — no customer, no ledger rows.
  const customerIdRaw = (formData.get("customerId") as string | null)?.trim();
  const customer = customerIdRaw
    ? await prisma.customer.findFirst({
        where: { id: customerIdRaw, isActive: true },
        select: { id: true },
      })
    : null;
  if (customerIdRaw && !customer) {
    return { error: "That customer was not found or is inactive." };
  }

  let totalRevenue = 0;
  let totalCost = 0;
  let warrantyFee = 0;
  const soldAt = new Date();

  const saleItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const unitPrice = customPrices[item.productId] ?? Number(product.sellingPrice);
    const unitCost = Number(product.costPrice);
    totalRevenue += unitPrice * item.quantity;
    totalCost += unitCost * item.quantity;

    // Warranty is priced per unit and stamped with its own expiry, so it survives any
    // later change to the shop default.
    const w = warrantyByProduct[item.productId];
    warrantyFee += w ? w.perUnit * item.quantity : 0;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      unitCost,
      warrantyPerUnit: w ? w.perUnit : null,
      warrantyMonths: w ? w.months : null,
      warrantyUntil: w ? warrantyUntilFrom(soldAt, w.months) : null,
    };
  });

  // Sale.warrantyFee stays as the SUM of the line warranties — every existing report,
  // backup and analytics query reads this field and must keep seeing the same thing.
  warrantyFee = roundMoney(warrantyFee);
  totalRevenue += warrantyFee;
  const profit = totalRevenue - totalCost;

  // How much the customer handed over at the counter. Clamped against the
  // server-computed total, so a stale or tampered client value can never record a
  // payment larger than the sale itself.
  // "Paid in full" arrives as a flag rather than a number: the total recomputed here
  // can differ by a cent from the one the form displayed (per-line prices are scaled
  // and rounded for discounts), and that cent would otherwise stay on the tab forever.
  const payInFull = formData.get("payInFull") === "1";
  const amountPaidRaw = Number(formData.get("amountPaid") ?? 0);
  const chargeAmount = roundMoney(totalRevenue);
  const amountPaid = !customer
    ? 0
    : payInFull
      ? chargeAmount
      : Math.min(
          Math.max(0, Number.isFinite(amountPaidRaw) ? roundMoney(amountPaidRaw) : 0),
          chargeAmount
        );

  let saleId = "";
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        sellerId: session.userId,
        customerId: customer?.id ?? null,
        totalRevenue,
        totalCost,
        profit,
        warrantyFee: warrantyFee > 0 ? warrantyFee : null,
        note: note || null,
        items: { create: saleItems },
      },
    });
    saleId = sale.id;

    // Credit layer. Revenue, cost and profit above are untouched by any of this —
    // the sale is still recorded in full the moment the goods leave the shop.
    if (customer) {
      const saleRef = `Sale #${sale.id.slice(-6).toUpperCase()}`;
      // A CHARGE is written even when fully paid, so the tab shows the whole story.
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          type: "CHARGE",
          amount: chargeAmount,
          saleId: sale.id,
          note: saleRef,
          userId: session.userId,
        },
      });
      if (amountPaid > 0) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: "PAYMENT",
            amount: amountPaid,
            method: "CASH",
            saleId: sale.id,
            note: `Paid at counter — ${saleRef}`,
            userId: session.userId,
          },
        });
      }
    }

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
  if (customer) {
    revalidatePath("/customers");
    revalidatePath(`/customers/${customer.id}`);
  }
  redirect("/sales");
}
