import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastTelegramMessage } from "@/lib/telegram";
import { getLicenseStatus } from "@/lib/license";
import { buildDailyReport } from "@/lib/daily-report";
import { reportDay } from "@/lib/notify-schedule";

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

  const config = await prisma.telegramConfig.findFirst();
  if (!config) return NextResponse.json({ skipped: true, reason: "No Telegram config" });

  if (!config.dailyReportEnabled) {
    return NextResponse.json({ skipped: true, reason: "Daily report switched off" });
  }

  // The day being closed, not the wall-clock day: the cron fires just before midnight
  // and a late run would otherwise report on the empty new day. See reportDay().
  const day = reportDay();
  if (config.lastDailyReportOn === day) {
    return NextResponse.json({ skipped: true, reason: `Already sent for ${day}` });
  }

  // Claim the day BEFORE sending, so a Vercel retry of a slow-but-successful run
  // cannot deliver the same report twice.
  const claimed = await prisma.telegramConfig.updateMany({
    where: { id: config.id, lastDailyReportOn: config.lastDailyReportOn },
    data: { lastDailyReportOn: day },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ skipped: true, reason: "Another run got there first" });
  }

  const text = await buildDailyReport(day);
  await broadcastTelegramMessage(config, text, "Markdown");

  if (license.telegramReminders && license.warningSoon) {
    await broadcastTelegramMessage(
      config,
      `⏳ *LICENSE EXPIRING SOON*\n` +
      `${license.isTrial ? "Free trial" : "License"} expires in *${license.daysLeft} day${license.daysLeft !== 1 ? "s" : ""}*.\n` +
      `Renew now — ${license.renewalText}.`,
      "Markdown"
    );
  }

  return NextResponse.json({ sent: true, day });
}
