import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { WhatsAppConfigForm } from "./whatsapp-config-form";
import { WhatsAppLogs } from "./whatsapp-logs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function WhatsAppPage() {
  await verifyRole(["ADMIN", "OWNER"]);

  const [config, logs] = await Promise.all([
    prisma.whatsAppConfig.findFirst(),
    prisma.whatsAppLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">WhatsApp Bot</h1>
        <p className="text-slate-300 text-sm mt-0.5">
          Configure Meta WhatsApp Cloud API for two-way messaging
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="config" className="text-white data-active:bg-blue-600 data-active:text-white">
            Configuration
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-white data-active:bg-blue-600 data-active:text-white">
            Message Logs
          </TabsTrigger>
          <TabsTrigger value="commands" className="text-white data-active:bg-blue-600 data-active:text-white">
            Bot Commands
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <WhatsAppConfigForm config={config} />
        </TabsContent>
        <TabsContent value="logs">
          <WhatsAppLogs logs={logs} />
        </TabsContent>
        <TabsContent value="commands">
          <BotCommandsHelp />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BotCommandsHelp() {
  const commands = [
    { cmd: "help", desc: "Show available commands" },
    { cmd: "stock samsung a54", desc: "Check stock for Samsung A54" },
    { cmd: "stock display", desc: "Find all displays in stock" },
    { cmd: "summary today", desc: "Today's sales summary" },
    { cmd: "summary week", desc: "This week's summary" },
    { cmd: "summary month", desc: "This month's summary" },
    { cmd: "lowstock", desc: "List all items below threshold" },
  ];

  return (
    <div className="mt-4 max-w-lg space-y-2">
      <p className="text-slate-300 text-sm mb-4">
        Send these commands to your WhatsApp number to query the system:
      </p>
      {commands.map((c) => (
        <div
          key={c.cmd}
          className="flex items-start gap-3 px-4 py-3 rounded-lg bg-slate-900 border border-slate-800"
        >
          <code className="text-blue-400 text-sm font-mono whitespace-nowrap">
            {c.cmd}
          </code>
          <span className="text-slate-300 text-sm">{c.desc}</span>
        </div>
      ))}
    </div>
  );
}
