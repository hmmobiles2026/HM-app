"use client";

import { Phone, Mail, MessageCircle, HelpCircle, BookOpen, ExternalLink } from "lucide-react";

const SUPPORT = {
  name: "Heshan Kavinda",
  whatsapp: "0770411504",
  email: "kavindesh518716@gmail.com",
};

const GUIDE_SECTIONS = [
  {
    title: "Dashboard",
    body: "After logging in you land on the Dashboard. It shows today's revenue & profit, this week's totals, total active products, a 30-day sales chart, and low-stock alerts.",
  },
  {
    title: "Stock / Products",
    body: "Go to Stock to view all products. Click + Add Product to create a new one (Brand, Model, Part name, Cost price, Selling price, Stock qty, Low-stock threshold). Use the pencil icon to edit. Trash icon deletes — you have 3 days to recover from the Recently Deleted section.",
  },
  {
    title: "Making a Sale",
    body: "Go to Sales → New Sale. Search for the product, set quantity, confirm price, then Complete Sale. Stock is reduced automatically and the sale is recorded.",
  },
  {
    title: "User Accounts (Staff)",
    body: "Go to Settings → Users (Admin only). Add staff with Seller role — they can make sales and check stock but cannot see financials. Each person logs in with their own username and password.",
  },
  {
    title: "Telegram Bot",
    body: "Your bot is already set up by your support contact. Open Telegram, find your bot, type /start, then send your app login password. You are logged in for 24 hours. The bot automatically sends low-stock alerts, stock-in notifications, a daily sales summary at 10 PM, and a midnight data backup. You can also type commands: today, week, month, report, low, or search any product name.",
  },
  {
    title: "Password Change",
    body: "Any user can change their own password from Settings → Password tab. Enter current password, new password, confirm, then save.",
  },
  {
    title: "License / Subscription",
    body: "Free trial: 4 months, full features. After expiry Telegram stops working. Renew with a license key (LKR 2,000 / 3 months). Contact support below to get a key.",
  },
];

export function SupportSettings() {
  return (
    <div className="mt-4 space-y-6 max-w-xl">

      {/* Support card */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-400" />
          <p className="text-sm font-semibold text-white">Support & Subscription</p>
        </div>
        <p className="text-xs text-slate-400">
          For renewals, issues, questions, or payment — contact:
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded-lg">
            <div className="h-7 w-7 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-400">HK</span>
            </div>
            <p className="text-sm font-medium text-white">{SUPPORT.name}</p>
          </div>

          <a
            href={`https://wa.me/94${SUPPORT.whatsapp.replace(/^0/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 bg-emerald-950/40 border border-emerald-900/40 rounded-lg hover:bg-emerald-950/70 transition-colors group"
          >
            <MessageCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm text-emerald-300 flex-1">{SUPPORT.whatsapp}</span>
            <ExternalLink className="h-3.5 w-3.5 text-emerald-600 group-hover:text-emerald-400" />
          </a>

          <a
            href={`mailto:${SUPPORT.email}`}
            className="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors group"
          >
            <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-300 flex-1">{SUPPORT.email}</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400" />
          </a>

          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded-lg">
            <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-300">{SUPPORT.whatsapp}</span>
          </div>
        </div>

        <div className="pt-1 border-t border-slate-700">
          <p className="text-xs text-slate-500">Subscription: <span className="text-slate-400 font-medium">LKR 2,000 / 3 months</span></p>
        </div>
      </div>

      {/* Guide sections */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-400">Quick Guide</p>
        </div>
        <div className="space-y-2">
          {GUIDE_SECTIONS.map((s) => (
            <details key={s.title} className="group bg-slate-900 border border-slate-800 rounded-xl">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
                <span className="text-sm font-medium text-white">{s.title}</span>
                <svg
                  className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-4 pb-3">
                <p className="text-xs text-slate-400 leading-relaxed">{s.body}</p>
              </div>
            </details>
          ))}
        </div>
      </div>

    </div>
  );
}
