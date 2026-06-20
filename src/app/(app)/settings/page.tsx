import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getLicenseStatus } from "@/lib/license";
import { SettingsLayout } from "./settings-layout";

export default async function SettingsPage() {
  const session = await verifySession();

  const isAdmin = session.role === "ADMIN";
  const isAdminOrOwner = session.role === "ADMIN" || session.role === "OWNER";

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [brands, deletedBrands, categories, suppliers, users, licenseStatus] = await Promise.all([
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
    isAdminOrOwner
      ? prisma.brand.findMany({
          where: { deletedAt: { gte: threeDaysAgo } },
          include: { models: { orderBy: { name: "asc" } } },
          orderBy: { deletedAt: "desc" },
        })
      : [],
    isAdminOrOwner
      ? prisma.category.findMany({
          include: {
            partBrands: {
              where: { OR: [{ deletedAt: null }, { deletedAt: { gte: threeDaysAgo } }] },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : [],
    isAdminOrOwner ? prisma.supplier.findMany({ orderBy: { name: "asc" } }) : [],
    isAdmin ? prisma.user.findMany({ orderBy: { name: "asc" } }) : [],
    isAdminOrOwner ? getLicenseStatus() : null,
  ]);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-white mb-5">Settings</h1>
      <SettingsLayout
        brands={brands}
        deletedBrands={deletedBrands}
        categories={categories}
        suppliers={suppliers}
        users={users}
        licenseStatus={licenseStatus}
        isAdmin={isAdmin}
        isAdminOrOwner={isAdminOrOwner}
      />
    </div>
  );
}
