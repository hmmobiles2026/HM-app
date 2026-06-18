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
import { SupportSettings } from "./support-settings";

export default async function SettingsPage() {
  const session = await verifySession();

  const isAdmin = session.role === "ADMIN";
  const isAdminOrOwner = session.role === "ADMIN" || session.role === "OWNER";

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [brands, deletedBrands, categories, users, licenseStatus] = await Promise.all([
    isAdminOrOwner
      ? prisma.brand.findMany({
          where: { deletedAt: null },
          include: {
            models: {
              where: { OR: [{ deletedAt: null }, { deletedAt: { gte: threeDaysAgo } }] },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : [],
    isAdmin
      ? prisma.brand.findMany({
          where: { deletedAt: { gte: threeDaysAgo } },
          include: { models: { orderBy: { name: "asc" } } },
          orderBy: { deletedAt: "desc" },
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
          <TabsTrigger value="support" className="text-white data-active:bg-blue-600 data-active:text-white">
            Support
          </TabsTrigger>
        </TabsList>

        {isAdminOrOwner && (
          <TabsContent value="brands">
            <BrandSettings brands={brands} deletedBrands={deletedBrands} isAdmin={isAdmin} />
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
        <TabsContent value="support">
          <SupportSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
