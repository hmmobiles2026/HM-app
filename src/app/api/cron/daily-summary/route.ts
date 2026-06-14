import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getLicenseStatus } from "@/lib/license";
import { buildDailyReport } from "@/lib/daily-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const license = await getLicenseStatus();
  if (!license.active) {
    const config = await prisma.telegramConfig.findFirst();
    if (config) {
      await sendTelegramMessage(
        config.botToken,
        config.chatId,
        `🔴 *LICENSE EXPIRED — HM Stocks*\n\n` +
        `Telegram alerts are now disabled.\n` +
        `Contact HM Stocks support to renew (LKR 2,000 / 3 months).`
      );
    }
    return NextResponse.json({ skipped: true, reason: "License expired" });
  }

  const [text, config] = await Promise.all([
    buildDailyReport(),
    prisma.telegramConfig.findFirst(),
  ]);

  if (config) {
    await sendTelegramMessage(config.botToken, config.chatId, text);

    if (license.daysLeft <= 7) {
      await sendTelegramMessage(
        config.botToken,
        config.chatId,
        `⏳ *LICENSE EXPIRING SOON*\n` +
        `${license.isTrial ? "Free trial" : "License"} expires in *${license.daysLeft} day${license.daysLeft !== 1 ? "s" : ""}*.\n` +
        `Renew now — LKR 2,000 / 3 months.`
      );
    }
  }

  return NextResponse.json({ sent: !!config });
}
