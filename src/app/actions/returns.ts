"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

const ReturnSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  reason: z.string().optional(),
});

export type ReturnState = { error?: string; success?: string } | undefined;

export async function createReturn(
  saleItemId: string,
  _state: ReturnState,
  formData: FormData
): Promise<ReturnState> {
  const session = await verifySession();

  const parsed = ReturnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid quantity." };

  const { quantity, reason } = parsed.data;

  const saleItem = await prisma.saleItem.findUnique({
    where: { id: saleItemId },
    include: {
      returns: { select: { quantity: true } },
      sale: { select: { id: true } },
      product: { select: { name: true } },
    },
  });

  if (!saleItem) return { error: "Sale item not found." };

  const alreadyReturned = saleItem.returns.reduce((s, r) => s + r.quantity, 0);
  const maxReturn = saleItem.quantity - alreadyReturned;
  if (quantity > maxReturn) {
    return { error: `Max returnable quantity is ${maxReturn}.` };
  }

  const refundAmount = Number(saleItem.unitPrice) * quantity;

  await prisma.$transaction([
    prisma.saleReturn.create({
      data: { saleItemId, quantity, reason: reason || null, refundAmount },
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
        note: `Return from sale #${saleItem.sale.id.slice(-6).toUpperCase()}${reason ? ` — ${reason}` : ""}`,
        userId: session.userId,
      },
    }),
  ]);

  revalidatePath("/sales");
  revalidatePath("/stock");
  return { success: `Returned ${quantity} × ${saleItem.product.name}. Stock restored.` };
}
