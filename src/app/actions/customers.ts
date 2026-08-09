"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyRole, verifySession } from "@/lib/dal";
import { getCustomerBalance } from "@/lib/customers";
import { roundMoney } from "@/lib/credit-math";

/**
 * Customer credit actions.
 *
 * Permissions, as agreed with the owner:
 *   SELLER      — may sell on credit and view balances (see sales.ts)
 *   OWNER/ADMIN — may add/edit customers, record payments and make adjustments
 *
 * Nothing in this file touches Sale.totalRevenue / totalCost / profit.
 */

export type CustomerActionState = { error?: string; success?: string } | undefined;

const CustomerSchema = z.object({
  shopName: z.string().trim().min(1, "Shop name is required"),
  ownerName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  creditLimit: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function parseCreditLimit(raw: string | undefined): number | null | "invalid" {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return roundMoney(n);
}

export async function createCustomer(
  _state: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  await verifyRole(["ADMIN", "OWNER"]);

  const parsed = CustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { error: msgs[0] ?? "Invalid input." };
  }

  const { shopName, ownerName, phone, address, note } = parsed.data;
  const creditLimit = parseCreditLimit(parsed.data.creditLimit);
  if (creditLimit === "invalid") return { error: "Credit limit must be 0 or more." };

  try {
    await prisma.customer.create({
      data: {
        shopName,
        ownerName: ownerName || null,
        phone: phone || null,
        address: address || null,
        creditLimit,
        note: note || null,
      },
    });
  } catch {
    // shopName is unique — a duplicate would split this shop's debt across two records.
    return { error: `"${shopName}" already exists. Open that shop instead.` };
  }

  revalidatePath("/customers");
  revalidatePath("/sales");
  return { success: `${shopName} added.` };
}

export async function updateCustomer(
  id: string,
  _state: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  await verifyRole(["ADMIN", "OWNER"]);

  const parsed = CustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { error: msgs[0] ?? "Invalid input." };
  }

  const { shopName, ownerName, phone, address, note } = parsed.data;
  const creditLimit = parseCreditLimit(parsed.data.creditLimit);
  if (creditLimit === "invalid") return { error: "Credit limit must be 0 or more." };

  try {
    await prisma.customer.update({
      where: { id },
      data: {
        shopName,
        ownerName: ownerName || null,
        phone: phone || null,
        address: address || null,
        creditLimit,
        note: note || null,
      },
    });
  } catch {
    return { error: `Could not save. "${shopName}" may already be taken.` };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/sales");
  return { success: "Customer updated." };
}

/**
 * Customers are never hard-deleted — their ledger is financial history. Deactivating
 * only hides them from the sale picker, and is refused while money is outstanding.
 */
export async function setCustomerActive(
  id: string,
  isActive: boolean
): Promise<CustomerActionState> {
  await verifyRole(["ADMIN", "OWNER"]);

  if (!isActive) {
    const balance = await getCustomerBalance(id);
    if (balance > 0) {
      return {
        error: `Cannot deactivate — LKR ${balance.toLocaleString("en-LK")} is still outstanding.`,
      };
    }
    if (balance < 0) {
      return {
        error: `Cannot deactivate — they have LKR ${Math.abs(balance).toLocaleString("en-LK")} paid in advance.`,
      };
    }
  }

  await prisma.customer.update({ where: { id }, data: { isActive } });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/sales");
  return { success: isActive ? "Customer reactivated." : "Customer deactivated." };
}

const PaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  method: z.enum(["CASH", "BANK", "CHEQUE", "OTHER"]),
  note: z.string().trim().optional(),
});

export async function recordPayment(
  _state: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const session = await verifyRole(["ADMIN", "OWNER"]);

  const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { error: msgs[0] ?? "Invalid payment." };
  }

  const { customerId, method, note } = parsed.data;
  const amount = roundMoney(parsed.data.amount);
  if (amount <= 0) return { error: "Enter an amount greater than zero." };

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { shopName: true },
  });
  if (!customer) return { error: "Customer not found." };

  await prisma.customerLedger.create({
    data: {
      customerId,
      type: "PAYMENT",
      amount,
      method,
      note: note || null,
      userId: session.userId,
    },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
  return {
    success: `Payment of LKR ${amount.toLocaleString("en-LK")} recorded for ${customer.shopName}.`,
  };
}

const AdjustmentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.coerce.number(),
  note: z.string().trim().min(1, "A reason is required for an adjustment."),
});

/**
 * Manual correction. The amount is SIGNED: positive means they owe more, negative
 * means they owe less. History is never edited — a mistake is corrected by adding
 * another row, so the trail stays intact.
 */
export async function addAdjustment(
  _state: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const session = await verifyRole(["ADMIN", "OWNER"]);

  const parsed = AdjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { error: msgs[0] ?? "Invalid adjustment." };
  }

  const { customerId, note } = parsed.data;
  const amount = roundMoney(parsed.data.amount);
  if (amount === 0) return { error: "Adjustment cannot be zero." };

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return { error: "Customer not found." };

  await prisma.customerLedger.create({
    data: {
      customerId,
      type: "ADJUSTMENT",
      amount,
      note,
      userId: session.userId,
    },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
  return {
    success:
      amount > 0
        ? `Added LKR ${amount.toLocaleString("en-LK")} to the balance.`
        : `Reduced the balance by LKR ${Math.abs(amount).toLocaleString("en-LK")}.`,
  };
}

/** Sellers may read balances, so this is session-only rather than owner-only. */
export async function lookupCustomerBalance(customerId: string): Promise<number> {
  await verifySession();
  return getCustomerBalance(customerId);
}
