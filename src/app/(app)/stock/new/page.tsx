import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await verifyRole(["ADMIN", "OWNER"]);

  const [brands, categories, suppliers] = await Promise.all([
    prisma.brand.findMany({
      where: { deletedAt: null },
      include: { models: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      include: { partBrands: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-white mb-6">Add New Product</h1>
      <ProductForm brands={brands} categories={categories} suppliers={suppliers} />
    </div>
  );
}
