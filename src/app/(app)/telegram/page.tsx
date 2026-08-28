import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { TelegramConfigForm } from "./telegram-config-form";
import { TelegramLogs } from "./telegram-logs";
import { TelegramRecipients } from "./telegram-recipients";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function TelegramPage() {
  await verifyRole(["ADMIN"]);

  const [config, logs, sessions] = await Promise.all([
    prisma.telegramConfig.findFirst(),
    prisma.telegramLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.telegramSession.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const knownChats = sessions.map((s) => ({
    chatId: s.chatId,
    name: s.user.name,
    role: s.role,
  }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-blue-400">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Telegram Bot</h1>
            {config ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">
                Not set up
              </span>
            )}
          </div>
          <p className="text-slate-300 text-sm mt-1">
            Query stock and sales from Telegram — works from anywhere
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="config">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="config" className="text-white data-active:bg-blue-600 data-active:text-white">
            Configuration
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-white data-active:bg-blue-600 data-active:text-white">
            Logs
            {logs.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                {logs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="commands" className="text-white data-active:bg-blue-600 data-active:text-white">
            Commands
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <div className="space-y-4">
            <TelegramConfigForm config={config} />
            {config && (
              <TelegramRecipients
                primaryChatId={config.chatId}
                extraChatIds={config.extraChatIds}
                knownChats={knownChats}
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="logs">
          <TelegramLogs logs={logs} />
        </TabsContent>
        <TabsContent value="commands">
          <BotCommandsHelp />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BotCommandsHelp() {
  const groups = [
    {
      label: "Find a part",
      color: "text-blue-400",
      bg: "bg-blue-950/30 border-blue-900/40",
      note: "Anything the bot doesn't recognise is treated as a stock search.",
      commands: [
        { cmd: "a06", shortcuts: [], desc: "Type any brand, model or part name" },
        { cmd: "samsung a06", shortcuts: ["iphone 17"], desc: "Two words narrow it down — every word must match" },
        { cmd: "stock", shortcuts: ["s"], desc: "Overall stock count and health" },
        { cmd: "stock samsung", shortcuts: ["s samsung", "price a06", "p a06"], desc: "Same search, with an explicit keyword" },
      ],
    },
    {
      label: "Alerts",
      color: "text-amber-400",
      bg: "bg-amber-950/30 border-amber-900/40",
      commands: [
        { cmd: "low", shortcuts: ["l", "/lowstock"], desc: "Items at or below their reorder level" },
      ],
    },
    {
      label: "Sales · Owner & Admin",
      color: "text-emerald-400",
      bg: "bg-emerald-950/30 border-emerald-900/40",
      commands: [
        { cmd: "today", shortcuts: ["t"], desc: "Today's revenue, profit and sale count" },
        { cmd: "week", shortcuts: ["w"], desc: "This week's totals (Friday to Thursday)" },
        { cmd: "month", shortcuts: ["m"], desc: "This month's totals" },
        { cmd: "report", shortcuts: ["r"], desc: "Full daily report — sales, low stock, dues" },
      ],
    },
    {
      label: "Customer credit · Owner & Admin",
      color: "text-cyan-400",
      bg: "bg-cyan-950/30 border-cyan-900/40",
      commands: [
        { cmd: "dues", shortcuts: ["credit"], desc: "Who owes money and how much, with phone numbers" },
      ],
    },
    {
      label: "Supplier returns · Owner & Admin",
      color: "text-orange-400",
      bg: "bg-orange-950/30 border-orange-900/40",
      commands: [
        { cmd: "suppliers", shortcuts: ["sup"], desc: "Pending and resolved supplier claims" },
      ],
    },
    {
      label: "Backup · Owner & Admin",
      color: "text-violet-400",
      bg: "bg-violet-950/30 border-violet-900/40",
      commands: [
        { cmd: "backup", shortcuts: ["bk"], desc: "Business snapshot — Admin receives the full JSON file" },
      ],
    },
    {
      label: "General",
      color: "text-slate-400",
      bg: "bg-slate-900 border-slate-800",
      commands: [
        { cmd: "help", shortcuts: ["/start"], desc: "Show the command list inside Telegram" },
        { cmd: "logout", shortcuts: [], desc: "Sign out — sessions last 2 days anyway" },
      ],
    },
  ];

  return (
    <div className="mt-4 max-w-lg space-y-4">
      <p className="text-slate-300 text-sm">
        Message the bot directly in Telegram with any of these. Send your app password
        once to sign in — it stays valid for 2 days.
      </p>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-sm">🟢🟡🔴</span>
        <p className="text-xs text-slate-300">
          Search results mark stock health: green in stock, amber running low, red out of
          stock. Sellers see price and quantity; Owner and Admin also see cost and margin.
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${g.color}`}>
            {g.label}
          </p>
          {g.note && <p className="text-xs text-slate-500 mb-2">{g.note}</p>}
          <div className="space-y-1.5">
            {g.commands.map((c) => (
              <div
                key={c.cmd}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${g.bg}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-white text-sm font-mono">{c.cmd}</code>
                    {c.shortcuts.map((s) => (
                      <code key={s} className="text-xs text-slate-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                        {s}
                      </code>
                    ))}
                  </div>
                  <p className="text-slate-300 text-xs mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-500">
        Every command also works with a leading slash — <code className="font-mono">/dues</code>{" "}
        is the same as <code className="font-mono">dues</code>.
      </p>
    </div>
  );
}
