"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, verifyRole } from "@/lib/dal";
import { roundMoney } from "@/lib/credit-math";
import { planWarrantyRefund } from "@/lib/warranty-math";

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
      sale: {
        select: {
          id: true,
          sellerId: true,
          warrantyFee: true,
          customerId: true,
          // Needed to tell a per-item sale apart from an old whole-bill one.
          items: { select: { warrantyPerUnit: true } },
        },
      },
      product: { select: { name: true, isActive: true, brand: { select: { name: true } } } },
    },
  });

  if (!saleItem) return { error: "Sale item not found." };

  if (session.role === "SELLER" && saleItem.sale.sellerId !== session.userId) {
    return { error: "You can only return items from your own sales." };
  }

  const alreadyReturned = saleItem.returns.reduce((s, r) => s + r.quantity, 0);
  const maxReturn = saleItem.quantity - alreadyReturned;
  if (quantity > maxReturn) {
    return { error: `Max returnable quantity is ${maxReturn}.` };
  }

  const refundAmount = Number(saleItem.unitPrice) * quantity;
  const costRecovery = Number(saleItem.unitCost) * quantity;
  const saleRef = saleItem.sale.id.slice(-6).toUpperCase();
  const refundWarranty = formData.get("refundWarranty") === "true";

  const warrantyPlan = planWarrantyRefund({
    refundRequested: refundWarranty,
    returnType,
    perUnitWarranty: saleItem.warrantyPerUnit ? Number(saleItem.warrantyPerUnit) : 0,
    saleWarrantyFee: Number(saleItem.sale.warrantyFee ?? 0),
    saleUsesPerItemWarranty: saleItem.sale.items.some((i) => i.warrantyPerUnit !== null),
    quantity,
  });
  const warrantyToRefund = warrantyPlan.amount;
  const isLegacyWarranty = warrantyPlan.mode === "legacy";

  if (returnType === "STOCK_BACK") {
    if (!saleItem.product.isActive) {
      return { error: "This product has been deleted and cannot be restocked." };
    }
    // Callback form so the customer credit can reference the new return's id inside
    // the same transaction. Same operations, same atomicity as the previous array form.
    await prisma.$transaction(async (tx) => {
      const created = await tx.saleReturn.create({
        data: {
          saleItemId,
          quantity,
          reason,
          refundAmount,
          returnType: "STOCK_BACK",
          warrantyRefund: warrantyToRefund > 0 ? warrantyToRefund : null,
        },
      });
      await tx.product.update({
        where: { id: saleItem.productId },
        data: { stockQty: { increment: quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: saleItem.productId,
          type: "RETURN",
          quantity,
          note: `Return from sale #${saleRef} — ${reason}`,
          userId: session.userId,
        },
      });
      // Revenue and cost both reverse; profit shrinks by the original margin on these units.
      //
      // Warranty: for per-item cover, DECREMENT the sale's running total by just the
      // units returned, so the other items keep theirs. Only the legacy whole-bill
      // case still nulls the field — there is no per-unit figure to subtract, and
      // nulling is what stops it being refunded twice on those old sales.
      await tx.sale.update({
        where: { id: saleItem.sale.id },
        data: {
          totalRevenue: { decrement: refundAmount + warrantyToRefund },
          totalCost: { decrement: costRecovery },
          profit: { decrement: refundAmount + warrantyToRefund - costRecovery },
          ...(warrantyToRefund > 0
            ? isLegacyWarranty
              ? { warrantyFee: null }
              : { warrantyFee: { decrement: warrantyToRefund } }
            : {}),
        },
      });
      // A credit customer is refunded against their tab, not in cash. Deliberately not
      // filtered on isActive — the debt is real whether or not the shop is still trading.
      if (saleItem.sale.customerId) {
        await tx.customerLedger.create({
          data: {
            customerId: saleItem.sale.customerId,
            type: "RETURN_CREDIT",
            // The warranty fee reverses with the sale, so it is credited back too.
            amount: roundMoney(refundAmount + warrantyToRefund),
            saleId: saleItem.sale.id,
            returnId: created.id,
            note: `Return on #${saleRef} — ${reason}`,
            userId: session.userId,
          },
        });
      }
    });
    revalidatePath("/sales");
    revalidatePath("/stock");
    if (saleItem.sale.customerId) {
      revalidatePath("/customers");
      revalidatePath(`/customers/${saleItem.sale.customerId}`);
    }
    const warrantyNote = warrantyToRefund > 0 ? ` Warranty fee (LKR ${warrantyToRefund.toLocaleString("en-LK")}) also reversed.` : "";
    return { success: `Returned ${quantity} × ${saleItem.product.name}. Stock restored.${warrantyNote}` };
  }

  // SUPPLIER_RETURN — stock stays out, track pending claim
  // Revenue reverses; cost stays (item is gone, supplier owes us costRecovery separately)
  await prisma.$transaction(async (tx) => {
    const created = await tx.saleReturn.create({
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
    await tx.sale.update({
      where: { id: saleItem.sale.id },
      data: {
        totalRevenue: { decrement: refundAmount },
        profit: { decrement: refundAmount },
      },
    });
    // The customer is credited either way. Whether we later recover the cost from the
    // supplier is a separate matter that does not affect what this shop is owed.
    if (saleItem.sale.customerId) {
      await tx.customerLedger.create({
        data: {
          customerId: saleItem.sale.customerId,
          type: "RETURN_CREDIT",
          amount: roundMoney(refundAmount),
          saleId: saleItem.sale.id,
          returnId: created.id,
          note: `Defective return on #${saleRef} — ${reason}`,
          userId: session.userId,
        },
      });
    }
  });

  revalidatePath("/sales");
  if (saleItem.sale.customerId) {
    revalidatePath("/customers");
    revalidatePath(`/customers/${saleItem.sale.customerId}`);
  }
  return { success: `Supplier return recorded. LKR ${costRecovery.toLocaleString("en-LK")} pending from supplier.` };
}

export async function resolveSupplierReturn(id: string): Promise<ReturnState> {
  await verifyRole(["ADMIN", "OWNER"]);
  const r = await prisma.saleReturn.findUnique({ where: { id }, select: { returnType: true } });
  if (!r || r.returnType !== "SUPPLIER_RETURN") {
    return { error: "Not a supplier return." };
  }
  await prisma.saleReturn.update({
    where: { id },
    data: { supplierStatus: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath("/sales");
  return { success: "Marked as resolved." };
}

export async function cancelSupplierReturn(id: string): Promise<ReturnState> {
  await verifyRole(["ADMIN", "OWNER"]);

  const r = await prisma.saleReturn.findUnique({
    where: { id },
    include: {
      saleItem: { select: { sale: { select: { id: true, customerId: true } } } },
    },
  });

  if (!r) return { error: "Return not found." };
  if (r.returnType !== "SUPPLIER_RETURN") return { error: "Cannot cancel a non-supplier return here." };
  if (r.supplierStatus === "RESOLVED") return { error: "Cannot undo a return that has already been resolved." };

  const customerId = r.saleItem.sale.customerId;

  await prisma.$transaction([
    // MUST run with the delete below. Cancelling undoes the whole event, so the credit
    // given to the customer has to go with it — otherwise they keep credit for a return
    // that no longer exists, and the shop quietly loses that money. There is no foreign
    // key doing this for us; it is deliberately explicit. See schema.prisma.
    prisma.customerLedger.deleteMany({
      where: { returnId: id, type: "RETURN_CREDIT" },
    }),
    prisma.saleReturn.delete({ where: { id } }),
    prisma.sale.update({
      where: { id: r.saleItem.sale.id },
      data: {
        totalRevenue: { increment: r.refundAmount },
        profit: { increment: r.refundAmount },
      },
    }),
  ]);

  revalidatePath("/sales");
  if (customerId) {
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
  }
  return { success: "Return cancelled. Sale figures restored." };
}
