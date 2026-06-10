import { verifyRole } from "@/lib/dal";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandSettings } from "./brand-settings";
import { ModelSettings } from "./model-settings";
import { CategorySettings } from "./category-settings";
import { UserSettings } from "./user-settings";

export default async function SettingsPage() {
  const session = await verifyRole(["ADMIN", "OWNER"]);

  const [brands, categories, users] = await Promise.all([
    prisma.brand.findMany({
      include: { models: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    session.role === "ADMIN"
      ? prisma.user.findMany({ orderBy: { name: "asc" } })
      : [],
  ]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      <Tabs defaultValue="brands">
        <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="brands" className="data-[state=active]:bg-blue-600">
            Brands
          </TabsTrigger>
          <TabsTrigger value="models" className="data-[state=active]:bg-blue-600">
            Models
          </TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-blue-600">
            Categories
          </TabsTrigger>
          {session.role === "ADMIN" && (
            <TabsTrigger value="users" className="data-[state=active]:bg-blue-600">
              Users
            </TabsTrigger>
          )}
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
      </Tabs>
    </div>
  );
}
