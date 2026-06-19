"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, verifyRole } from "@/lib/dal";

const ReturnSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  reason: z.string().min(1, "Reason is required"),
  returnType: z.enum(["STOCK_BACK", "SUPPLIER_RETURN"]),
  supplierId: z.string().optional(),
});

export type ReturnState = { error?: string; success?: string } | undefined;

export async function createReturn(
  saleItemId: string,
  _state: ReturnState,
  formData: FormData
): Promise<ReturnState> {
  const session = await verifySession();

  const parsed = ReturnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { error: msgs[0] ?? "Invalid input." };
  }

  const { quantity, reason, returnType, supplierId } = parsed.data;

  if (returnType === "SUPPLIER_RETURN" && !supplierId) {
    return { error: "Select a supplier for this return." };
  }

  const saleItem = await prisma.saleItem.findUnique({
    where: { id: saleItemId },
    include: {
      returns: { select: { quantity: true } },
      sale: { select: { id: true } },
      product: { select: { name: true, brand: { select: { name: true } } } },
    },
  });

  if (!saleItem) return { error: "Sale item not found." };

  const alreadyReturned = saleItem.returns.reduce((s, r) => s + r.quantity, 0);
  const maxReturn = saleItem.quantity - alreadyReturned;
  if (quantity > maxReturn) {
    return { error: `Max returnable quantity is ${maxReturn}.` };
  }

  const refundAmount = Number(saleItem.unitPrice) * quantity;
  const costRecovery = Number(saleItem.unitCost) * quantity;
  const saleRef = saleItem.sale.id.slice(-6).toUpperCase();

  if (returnType === "STOCK_BACK") {
    await prisma.$transaction([
      prisma.saleReturn.create({
        data: {
          saleItemId,
          quantity,
          reason,
          refundAmount,
          returnType: "STOCK_BACK",
        },
      }),
      prisma.product.update({
        where: { id: saleItem.productId },
        data: { stockQty: { increment: quantity } },
      }),
      prisma.stockMovement.create({
        data: {
          productId: saleItem.productId,
          type: "RETURN",
          quantity,
          note: `Return from sale #${saleRef} — ${reason}`,
          userId: session.userId,
        },
      }),
    ]);
    revalidatePath("/sales");
    revalidatePath("/stock");
    return { success: `Returned ${quantity} × ${saleItem.product.name}. Stock restored.` };
  }

  // SUPPLIER_RETURN — stock stays out, track pending claim
  await prisma.saleReturn.create({
    data: {
      saleItemId,
      quantity,
      reason,
      refundAmount,
      returnType: "SUPPLIER_RETURN",
      supplierId: supplierId!,
      costRecovery,
      supplierStatus: "PENDING",
    },
  });

  revalidatePath("/sales");
  return { success: `Supplier return recorded. LKR ${costRecovery.toLocaleString("en-LK")} pending from supplier.` };
}

export async function resolveSupplierReturn(id: string): Promise<ReturnState> {
  await verifyRole(["ADMIN", "OWNER"]);
  await prisma.saleReturn.update({
    where: { id },
    data: { supplierStatus: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath("/sales");
  return { success: "Marked as resolved." };
}
