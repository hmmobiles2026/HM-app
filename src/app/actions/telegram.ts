"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { telegramRecipients } from "@/lib/telegram";

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

  // Tests EVERY recipient, not just the primary. A silent second recipient is exactly
  // the failure this button exists to catch, so it reports each one individually.
  const recipients = telegramRecipients(config);

  try {
    const results = await Promise.all(
      recipients.map(async (chatId) => {
        const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "✅ HM Stocks Telegram bot is connected and working!",
          }),
        });
        const data = await res.json();
        return { chatId, ok: !!data.ok, reason: data.description as string | undefined };
      })
    );

    const delivered = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    if (delivered.length === 0) {
      return { error: `Telegram: ${failed[0]?.reason ?? "no recipients configured"}` };
    }
    if (failed.length > 0) {
      return {
        error: `Sent to ${delivered.length} of ${results.length}. Failed: ${failed
          .map((f) => `${f.chatId} (${f.reason ?? "unknown"})`)
          .join(", ")}`,
      };
    }
    return {
      success:
        results.length === 1
          ? `Test message sent to chat ${recipients[0]}`
          : `Test message sent to all ${results.length} recipients`,
    };
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

export async function getWebhookInfo(): Promise<TelegramState> {
  await verifyRole(["ADMIN"]);

  const config = await prisma.telegramConfig.findFirst();
  if (!config?.botToken) return { error: "Save your bot token first." };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getWebhookInfo`
    );
    const data = await res.json();
    if (!data.ok) return { error: `Telegram error: ${data.description}` };

    const info = data.result;
    const url = info.url || "(none — not registered)";
    const pending = info.pending_update_count ?? 0;
    const lastError = info.last_error_message
      ? ` | Last error: ${info.last_error_message}`
      : "";

    return { success: `Webhook URL: ${url} | Pending: ${pending}${lastError}` };
  } catch {
    return { error: "Could not reach Telegram." };
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

/**
 * Manage who receives notifications.
 *
 * The primary chatId is set with the bot config; this controls everyone ELSE who gets
 * alerts, daily reports and backups. Without it there is only one recipient, and a
 * shop owner can appear to have a working bot — replies to their own commands arrive
 * fine — while never receiving a single push.
 */
export async function updateTelegramRecipients(
  _state: TelegramState,
  formData: FormData
): Promise<TelegramState> {
  await verifyRole(["ADMIN"]);

  const config = await prisma.telegramConfig.findFirst();
  if (!config) return { error: "Set up the bot first." };

  const raw = (formData.get("extraChatIds") as string | null) ?? "";
  const ids = [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];

  // Telegram chat ids are integers; groups and channels are negative.
  const invalid = ids.filter((id) => !/^-?\d+$/.test(id));
  if (invalid.length > 0) {
    return { error: `Not a valid chat ID: ${invalid.join(", ")}. Digits only, may start with -.` };
  }

  // The primary already receives everything; listing it again would double-send.
  const extras = ids.filter((id) => id !== config.chatId.trim());

  await prisma.telegramConfig.update({
    where: { id: config.id },
    data: { extraChatIds: extras },
  });

  revalidatePath("/telegram");
  return {
    success:
      extras.length === 0
        ? "Extra recipients cleared. Only the main chat will be notified."
        : `Saved. Notifications now go to ${extras.length + 1} chats.`,
  };
}

/**
 * Chats currently logged into the bot, offered as one-tap additions so nobody has to
 * hunt for a numeric chat ID.
 */
export async function getKnownTelegramChats(): Promise<
  { chatId: string; name: string; role: string }[]
> {
  await verifyRole(["ADMIN"]);
  const sessions = await prisma.telegramSession.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map((s) => ({ chatId: s.chatId, name: s.user.name, role: s.role }));
}
