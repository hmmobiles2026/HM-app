import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandSettings } from "./brand-settings";
import { ModelSettings } from "./model-settings";
import { CategorySettings } from "./category-settings";
import { UserSettings } from "./user-settings";
import { BackupSettings } from "./backup-settings";
import { LicenseSettings } from "./license-settings";

export default async function SettingsPage() {
  const session = await verifyRole(["ADMIN", "OWNER"]);

  const [brands, categories, users, licenseStatus] = await Promise.all([
    prisma.brand.findMany({
      include: { models: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    session.role === "ADMIN"
      ? prisma.user.findMany({ orderBy: { name: "asc" } })
      : [],
    getLicenseStatus(),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      <Tabs defaultValue="brands">
        <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="brands" className="text-white data-active:bg-blue-600 data-active:text-white">
            Brands
          </TabsTrigger>
          <TabsTrigger value="models" className="text-white data-active:bg-blue-600 data-active:text-white">
            Models
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-white data-active:bg-blue-600 data-active:text-white">
            Categories
          </TabsTrigger>
          {session.role === "ADMIN" && (
            <TabsTrigger value="users" className="text-white data-active:bg-blue-600 data-active:text-white">
              Users
            </TabsTrigger>
          )}
          {session.role === "ADMIN" && (
            <TabsTrigger value="backup" className="text-white data-active:bg-blue-600 data-active:text-white">
              Backup
            </TabsTrigger>
          )}
          <TabsTrigger value="license" className="text-white data-active:bg-blue-600 data-active:text-white">
            License
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands">
          <BrandSettings brands={brands} isAdmin={session.role === "ADMIN"} />
        </TabsContent>
        <TabsContent value="models">
          <ModelSettings brands={brands} isAdmin={session.role === "ADMIN"} />
        </TabsContent>
        <TabsContent value="categories">
          <CategorySettings categories={categories} isAdmin={session.role === "ADMIN"} />
        </TabsContent>
        {session.role === "ADMIN" && (
          <TabsContent value="users">
            <UserSettings users={users} />
          </TabsContent>
        )}
        {session.role === "ADMIN" && (
          <TabsContent value="backup">
            <BackupSettings />
          </TabsContent>
        )}
        <TabsContent value="license">
          <LicenseSettings status={licenseStatus} isAdmin={session.role === "ADMIN"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
