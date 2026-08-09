import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastTelegramMessage } from "@/lib/telegram";
import { getLicenseStatus } from "@/lib/license";
import { buildDailyReport } from "@/lib/daily-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const license = await getLicenseStatus();
  if (!license.active) {
    const config = await prisma.telegramConfig.findFirst();
    if (config) {
      await broadcastTelegramMessage(
        config,
        `🔴 *LICENSE EXPIRED — HM Stocks*\n\n` +
        `Telegram alerts are now disabled.\n` +
        `Contact HM Stocks support to renew (LKR 2,000 / 3 months).`,
        "Markdown"
      );
    }
    return NextResponse.json({ skipped: true, reason: "License expired" });
  }

  const [text, config] = await Promise.all([
    buildDailyReport(),
    prisma.telegramConfig.findFirst(),
  ]);

  if (config) {
    await broadcastTelegramMessage(
        config, text, "Markdown");

    if (license.daysLeft <= 7) {
      await broadcastTelegramMessage(
        config,
        `⏳ *LICENSE EXPIRING SOON*\n` +
        `${license.isTrial ? "Free trial" : "License"} expires in *${license.daysLeft} day${license.daysLeft !== 1 ? "s" : ""}*.\n` +
        `Renew now — LKR 2,000 / 3 months.`,
        "Markdown"
      );
    }
  }

  return NextResponse.json({ sent: !!config });
}
