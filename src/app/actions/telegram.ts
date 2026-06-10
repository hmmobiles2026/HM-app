"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { sendTelegramMessage } from "@/lib/telegram";

export type TelegramState = { error?: string; success?: string } | undefined;

export async function saveTelegramConfig(
  _: TelegramState,
  formData: FormData
): Promise<TelegramState> {
  await verifyRole(["ADMIN"]);

  const botToken = (formData.get("botToken") as string)?.trim();
  const chatId = (formData.get("chatId") as string)?.trim();
  const webhookSecret = (formData.get("webhookSecret") as string)?.trim();

  if (!botToken || !chatId || !webhookSecret) {
    return { error: "Bot token, chat ID, and webhook secret are required." };
  }

  const existing = await prisma.telegramConfig.findFirst();
  if (existing) {
    await prisma.telegramConfig.update({
      where: { id: existing.id },
      data: { botToken, chatId, webhookSecret },
    });
  } else {
    await prisma.telegramConfig.create({
      data: { botToken, chatId, webhookSecret },
    });
  }

  revalidatePath("/telegram");
  return { success: "Telegram config saved." };
}

export async function sendTestTelegramMessage(): Promise<TelegramState> {
  await verifyRole(["ADMIN"]);

  const config = await prisma.telegramConfig.findFirst({ where: { isActive: true } });
  if (!config) return { error: "No Telegram config found." };

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: "✅ HM Stocks Telegram bot is connected and working!",
      }),
    });
    const data = await res.json();
    if (!data.ok) return { error: `Telegram: ${data.description}` };
    return { success: `Test message sent to chat ${config.chatId}` };
  } catch {
    return { error: "Could not reach Telegram. Check your network connection." };
  }
}

export async function registerTelegramWebhook(appUrl: string): Promise<TelegramState> {
  await verifyRole(["ADMIN"]);

  const config = await prisma.telegramConfig.findFirst({ where: { isActive: true } });
  if (!config) return { error: "Save your config first before registering the webhook." };

  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: config.webhookSecret,
          allowed_updates: ["message"],
        }),
      }
    );
    const data = await res.json();
    if (!data.ok) return { error: `Telegram error: ${data.description}` };
    return { success: `Webhook registered at ${webhookUrl}` };
  } catch {
    return { error: "Could not reach Telegram. Check your network connection and bot token." };
  }
}

export async function getTelegramChatId(): Promise<TelegramState> {
  await verifyRole(["ADMIN"]);

  const config = await prisma.telegramConfig.findFirst();
  if (!config?.botToken) return { error: "Save your bot token first." };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getUpdates?limit=5`
    );
    const data = await res.json();

    if (!data.ok) return { error: `Telegram error: ${data.description}` };

    const chatId = data.result
      ?.map((u: { message?: { chat?: { id?: number } } }) => u?.message?.chat?.id)
      ?.find((id: number | undefined) => id != null)
      ?.toString();

    if (!chatId) {
      return {
        error:
          "No messages found. Open Telegram, find your bot, send any message to it, then try again.",
      };
    }

    return { success: `Your Chat ID is: ${chatId}` };
  } catch {
    return { error: "Could not reach Telegram. Check your network connection and bot token." };
  }
}
