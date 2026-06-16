import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandSettings } from "./brand-settings";
import { ModelSettings } from "./model-settings";
import { CategorySettings } from "./category-settings";
import { UserSettings } from "./user-settings";
import { BackupSettings } from "./backup-settings";
import { LicenseSettings } from "./license-settings";
import { PasswordSettings } from "./password-settings";

export default async function SettingsPage() {
  const session = await verifySession();

  const isAdmin = session.role === "ADMIN";
  const isAdminOrOwner = session.role === "ADMIN" || session.role === "OWNER";

  const [brands, categories, users, licenseStatus] = await Promise.all([
    isAdminOrOwner
      ? prisma.brand.findMany({
          include: { models: { orderBy: { name: "asc" } } },
          orderBy: { name: "asc" },
        })
      : [],
    isAdminOrOwner ? prisma.category.findMany({ orderBy: { name: "asc" } }) : [],
    isAdmin ? prisma.user.findMany({ orderBy: { name: "asc" } }) : [],
    isAdminOrOwner ? getLicenseStatus() : null,
  ]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      <Tabs defaultValue={isAdminOrOwner ? "brands" : "password"}>
        <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
          {isAdminOrOwner && (
            <TabsTrigger value="brands" className="text-white data-active:bg-blue-600 data-active:text-white">
              Brands
            </TabsTrigger>
          )}
          {isAdminOrOwner && (
            <TabsTrigger value="models" className="text-white data-active:bg-blue-600 data-active:text-white">
              Models
            </TabsTrigger>
          )}
          {isAdminOrOwner && (
            <TabsTrigger value="categories" className="text-white data-active:bg-blue-600 data-active:text-white">
              Categories
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="users" className="text-white data-active:bg-blue-600 data-active:text-white">
              Users
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="backup" className="text-white data-active:bg-blue-600 data-active:text-white">
              Backup
            </TabsTrigger>
          )}
          {isAdminOrOwner && (
            <TabsTrigger value="license" className="text-white data-active:bg-blue-600 data-active:text-white">
              License
            </TabsTrigger>
          )}
          <TabsTrigger value="password" className="text-white data-active:bg-blue-600 data-active:text-white">
            Password
          </TabsTrigger>
        </TabsList>

        {isAdminOrOwner && (
          <TabsContent value="brands">
            <BrandSettings brands={brands} isAdmin={isAdmin} />
          </TabsContent>
        )}
        {isAdminOrOwner && (
          <TabsContent value="models">
            <ModelSettings brands={brands} isAdmin={isAdmin} />
          </TabsContent>
        )}
        {isAdminOrOwner && (
          <TabsContent value="categories">
            <CategorySettings categories={categories} isAdmin={isAdmin} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="users">
            <UserSettings users={users} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="backup">
            <BackupSettings />
          </TabsContent>
        )}
        {isAdminOrOwner && licenseStatus && (
          <TabsContent value="license">
            <LicenseSettings status={licenseStatus} isAdmin={isAdmin} />
          </TabsContent>
        )}
        <TabsContent value="password">
          <PasswordSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
