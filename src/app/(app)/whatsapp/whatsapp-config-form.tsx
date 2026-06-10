"use client";

import { useActionState } from "react";
import { saveWhatsAppConfig, sendTestMessage } from "@/app/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Config = {
  id: string;
  phoneNumberId: string;
  accessToken: string;
  webhookSecret: string;
  recipientNumber: string;
  devNumber: string | null;
} | null;

export function WhatsAppConfigForm({ config }: { config: Config }) {
  const [state, action, pending] = useActionState(async (s: unknown, fd: FormData) => {
    const result = await saveWhatsAppConfig(s as undefined, fd);
    if (result?.success) toast.success(result.success);
    if (result?.error) toast.error(result.error);
    return result;
  }, undefined);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/whatsapp/webhook`
      : "/api/whatsapp/webhook";

  return (
    <div className="mt-4 max-w-lg space-y-6">
      {/* Setup guide */}
      <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl p-4 space-y-2">
        <p className="text-blue-300 text-sm font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Setup Guide
        </p>
        <ol className="text-slate-400 text-xs space-y-1 list-decimal list-inside">
          <li>Go to Meta Developer Console → Create App → WhatsApp</li>
          <li>Get your Phone Number ID and Access Token</li>
          <li>
            Set webhook URL to:{" "}
            <code className="text-blue-300 bg-slate-900 px-1 rounded text-[10px]">
              {webhookUrl}
            </code>
          </li>
          <li>Subscribe to <em>messages</em> in the webhook fields</li>
          <li>Save config below then test</li>
        </ol>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Phone Number ID *</Label>
            <Input
              name="phoneNumberId"
              defaultValue={config?.phoneNumberId}
              placeholder="From Meta Developer Console"
              className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Webhook Secret *</Label>
            <Input
              name="webhookSecret"
              defaultValue={config?.webhookSecret}
              placeholder="Your custom verify token"
              className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-xs">Access Token *</Label>
          <Input
            name="accessToken"
            type="password"
            defaultValue={config?.accessToken}
            placeholder="Bearer token from Meta"
            className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Owner WhatsApp Number *</Label>
            <Input
              name="recipientNumber"
              defaultValue={config?.recipientNumber}
              placeholder="+94771234567"
              className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Developer Number (optional)</Label>
            <Input
              name="devNumber"
              defaultValue={config?.devNumber ?? ""}
              placeholder="+94771234567"
              className="bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">For testing — test messages go here</p>
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500">
            {pending ? "Saving…" : "Save Config"}
          </Button>
          {config && (
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 text-slate-300 hover:text-white"
              onClick={async () => {
                const r = await sendTestMessage();
                if (r?.success) toast.success(r.success);
                if (r?.error) toast.error(r.error);
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              Test Message
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
