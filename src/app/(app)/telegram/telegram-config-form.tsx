"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveTelegramConfig,
  sendTestTelegramMessage,
  registerTelegramWebhook,
  getTelegramChatId,
  getWebhookInfo,
} from "@/app/actions/telegram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, RefreshCw, Copy, Check, Loader2, Hash, Info } from "lucide-react";
import { toast } from "sonner";

type Config = {
  id: string;
  botToken: string;
  chatId: string;
  webhookSecret: string;
} | null;

const steps = [
  {
    n: 1,
    title: "Create a bot",
    body: (
      <>
        Open Telegram → search{" "}
        <span className="text-blue-300 font-mono text-xs">@BotFather</span> → send{" "}
        <span className="text-blue-300 font-mono text-xs">/newbot</span> → follow the
        prompts. Username must end in <span className="text-blue-300 font-mono text-xs">bot</span>.
      </>
    ),
  },
  {
    n: 2,
    title: "Copy the bot token",
    body: "BotFather sends you a long token like 7123456789:AAH… — paste it in the field below.",
  },
  {
    n: 3,
    title: "Get your Chat ID",
    body: (
      <>
        Send any message to your new bot in Telegram, then click{" "}
        <strong className="text-slate-200">Get Chat ID</strong> below to auto-fill it.
      </>
    ),
  },
  {
    n: 4,
    title: "Register webhook",
    body: "Once deployed to a public URL (Vercel etc.), click Register Webhook. For local testing use ngrok.",
  },
];

export function TelegramConfigForm({ config }: { config: Config }) {
  const [state, action, pending] = useActionState(
    async (s: unknown, fd: FormData) => {
      const result = await saveTelegramConfig(s as undefined, fd);
      if (result?.success) toast.success(result.success);
      if (result?.error) toast.error(result.error);
      return result;
    },
    undefined
  );

  const [webhookUrl, setWebhookUrl] = useState("/api/telegram/webhook");
  const [copied, setCopied] = useState(false);
  const [testingMsg, setTestingMsg] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [gettingId, setGettingId] = useState(false);
  const [checkingWebhook, setCheckingWebhook] = useState(false);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/telegram/webhook`);
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTestMessage() {
    setTestingMsg(true);
    const r = await sendTestTelegramMessage();
    setTestingMsg(false);
    if (r?.success) toast.success(r.success);
    if (r?.error) toast.error(r.error);
  }

  async function handleRegisterWebhook() {
    setRegistering(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const r = await registerTelegramWebhook(origin);
    setRegistering(false);
    if (r?.success) toast.success(r.success, { duration: 6000 });
    if (r?.error) toast.error(r.error);
  }

  async function handleCheckWebhook() {
    setCheckingWebhook(true);
    const r = await getWebhookInfo();
    setCheckingWebhook(false);
    if (r?.success) toast.info(r.success, { duration: 10000 });
    if (r?.error) toast.error(r.error);
  }

  async function handleGetChatId() {
    setGettingId(true);
    const r = await getTelegramChatId();
    setGettingId(false);
    if (r?.success) toast.success(r.success, { duration: 8000 });
    if (r?.error) toast.error(r.error);
  }

  return (
    <div className="mt-4 max-w-lg space-y-5">

      {/* Status banner */}
      {config ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-900/50">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          <div>
            <p className="text-emerald-300 text-sm font-semibold">Bot configured</p>
            <p className="text-slate-400 text-xs">Chat ID: {config.chatId}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700">
          <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" />
          <p className="text-slate-400 text-sm">Not configured — follow the steps below</p>
        </div>
      )}

      {/* Setup steps */}
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold mt-0.5">
              {s.n}
            </span>
            <div>
              <p className="text-slate-200 text-xs font-semibold mb-0.5">{s.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      <form action={action} className="space-y-4">
        {/* Bot token */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Bot Token *</Label>
          <Input
            name="botToken"
            type="password"
            defaultValue={config?.botToken ?? ""}
            placeholder="7123456789:AAHabcdef…"
            className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500 font-mono"
          />
          <p className="text-xs text-slate-500">Provided by @BotFather after creating the bot</p>
        </div>

        {/* Chat ID + Webhook secret */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Chat ID *</Label>
            <Input
              name="chatId"
              defaultValue={config?.chatId ?? ""}
              placeholder="123456789"
              className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500 font-mono"
            />
            <button
              type="button"
              onClick={handleGetChatId}
              disabled={gettingId}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
            >
              {gettingId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Hash className="h-3 w-3" />
              )}
              {gettingId ? "Fetching…" : "Get Chat ID automatically"}
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Webhook Secret *</Label>
            <Input
              name="webhookSecret"
              defaultValue={config?.webhookSecret ?? ""}
              placeholder="any-random-string"
              className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">Keeps your webhook endpoint private</p>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Webhook URL</Label>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-3 py-2">
            <code className="text-blue-300 text-xs flex-1 break-all">{webhookUrl}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-xs text-slate-500">Register this URL with Telegram after deployment</p>
        </div>

        {state?.error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500">
            {pending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Config"}
          </Button>

          {config && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={testingMsg}
                className="border-slate-700 text-slate-300 hover:text-white"
                onClick={handleTestMessage}
              >
                {testingMsg ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {testingMsg ? "Sending…" : "Test Message"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={registering}
                className="border-slate-700 text-slate-300 hover:text-white"
                onClick={handleRegisterWebhook}
              >
                {registering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {registering ? "Registering…" : "Register Webhook"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={checkingWebhook}
                className="border-slate-700 text-slate-300 hover:text-white"
                onClick={handleCheckWebhook}
              >
                {checkingWebhook ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Info className="h-4 w-4 mr-2" />}
                {checkingWebhook ? "Checking…" : "Check Webhook"}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
