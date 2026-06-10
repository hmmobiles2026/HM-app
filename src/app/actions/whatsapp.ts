"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export type WAConfigState = { error?: string; success?: string } | undefined;

export async function saveWhatsAppConfig(
  _: WAConfigState,
  formData: FormData
): Promise<WAConfigState> {
  await verifyRole(["ADMIN", "OWNER"]);

  const phoneNumberId = (formData.get("phoneNumberId") as string)?.trim();
  const accessToken = (formData.get("accessToken") as string)?.trim();
  const webhookSecret = (formData.get("webhookSecret") as string)?.trim();
  const recipientNumber = (formData.get("recipientNumber") as string)?.trim();
  const devNumber = (formData.get("devNumber") as string)?.trim() || null;

  if (!phoneNumberId || !accessToken || !webhookSecret || !recipientNumber) {
    return { error: "All required fields must be filled." };
  }

  const existing = await prisma.whatsAppConfig.findFirst();
  if (existing) {
    await prisma.whatsAppConfig.update({
      where: { id: existing.id },
      data: { phoneNumberId, accessToken, webhookSecret, recipientNumber, devNumber },
    });
  } else {
    await prisma.whatsAppConfig.create({
      data: { phoneNumberId, accessToken, webhookSecret, recipientNumber, devNumber },
    });
  }

  revalidatePath("/whatsapp");
  return { success: "WhatsApp config saved." };
}

export async function sendTestMessage(): Promise<WAConfigState> {
  await verifyRole(["ADMIN", "OWNER"]);

  const config = await prisma.whatsAppConfig.findFirst({ where: { isActive: true } });
  if (!config) return { error: "No WhatsApp config found." };

  const target = config.devNumber || config.recipientNumber;
  const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: target,
      type: "text",
      text: { body: "✅ HM Stocks WhatsApp bot is connected and working!", preview_url: false },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return { error: `Failed: ${err?.error?.message ?? "Unknown error"}` };
  }

  return { success: `Test message sent to ${target}` };
}
