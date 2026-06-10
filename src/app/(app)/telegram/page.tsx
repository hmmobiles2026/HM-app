import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { TelegramConfigForm } from "./telegram-config-form";
import { TelegramLogs } from "./telegram-logs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function TelegramPage() {
  await verifyRole(["ADMIN"]);

  const [config, logs] = await Promise.all([
    prisma.telegramConfig.findFirst(),
    prisma.telegramLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

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
              <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                Not set up
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Query stock and sales from Telegram — works from anywhere
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="config">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="config" className="data-[state=active]:bg-blue-600">
            Configuration
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600">
            Logs
            {logs.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                {logs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="commands" className="data-[state=active]:bg-blue-600">
            Commands
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <TelegramConfigForm config={config} />
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
      label: "Sales Summary",
      color: "text-emerald-400",
      bg: "bg-emerald-950/30 border-emerald-900/40",
      commands: [
        { cmd: "today", shortcuts: ["t", "/today"], desc: "Today's revenue, profit & sale count" },
        { cmd: "week", shortcuts: ["w", "/week"], desc: "This week's totals" },
        { cmd: "month", shortcuts: ["m", "/month"], desc: "This month's totals" },
      ],
    },
    {
      label: "Stock",
      color: "text-blue-400",
      bg: "bg-blue-950/30 border-blue-900/40",
      commands: [
        { cmd: "stock", shortcuts: ["s"], desc: "Overall stock count and health" },
        { cmd: "stock samsung", shortcuts: ["s samsung"], desc: "Search by brand, model, or part name" },
        { cmd: "iphone 14", shortcuts: [], desc: "Any unrecognized text is treated as a stock search" },
      ],
    },
    {
      label: "Alerts",
      color: "text-amber-400",
      bg: "bg-amber-950/30 border-amber-900/40",
      commands: [
        { cmd: "low", shortcuts: ["/lowstock"], desc: "All items at or below their alert threshold" },
      ],
    },
    {
      label: "General",
      color: "text-slate-400",
      bg: "bg-slate-900 border-slate-800",
      commands: [
        { cmd: "help", shortcuts: ["/help", "/start"], desc: "Show the command list inside Telegram" },
      ],
    },
  ];

  return (
    <div className="mt-4 max-w-lg space-y-4">
      <p className="text-slate-400 text-sm">
        Message your bot directly in Telegram with any of these:
      </p>
      {groups.map((g) => (
        <div key={g.label}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${g.color}`}>
            {g.label}
          </p>
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
                      <code key={s} className="text-xs text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                        {s}
                      </code>
                    ))}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
