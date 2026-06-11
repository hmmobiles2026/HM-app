import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { StockList } from "./stock-list";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Plus, Upload, RefreshCcw, Layers } from "lucide-react";

async function getStock(searchParams: {
  q?: string;
  brand?: string;
  category?: string;
  grade?: string;
  filter?: string;
}) {
  const where: Record<string, unknown> = { isActive: true };

  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: "insensitive" } },
      { description: { contains: searchParams.q, mode: "insensitive" } },
      { tags: { has: searchParams.q.toLowerCase() } },
      { brand: { name: { contains: searchParams.q, mode: "insensitive" } } },
      { model: { name: { contains: searchParams.q, mode: "insensitive" } } },
    ];
  }
  if (searchParams.brand) where.brandId = searchParams.brand;
  if (searchParams.category) where.categoryId = searchParams.category;
  if (searchParams.grade) where.qualityGrade = searchParams.grade;

  const products = await prisma.product.findMany({
    where: where as NonNullable<Parameters<typeof prisma.product.findMany>[0]>["where"],
    include: {
      brand: true,
      model: true,
      category: true,
    },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
  });

  const filtered =
    searchParams.filter === "low"
      ? products.filter((p) => p.stockQty <= p.lowStockThreshold)
      : products;

  return filtered.map((p) => ({
    ...p,
    costPrice: p.costPrice.toNumber(),
    sellingPrice: p.sellingPrice.toNumber(),
  }));
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    category?: string;
    grade?: string;
    filter?: string;
  }>;
}) {
  const session = await verifySession();
  const params = await searchParams;
  const [products, brands, categories] = await Promise.all([
    getStock(params),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const canEdit = session.role === "ADMIN" || session.role === "OWNER";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Stock</h1>
          <p className="text-slate-300 text-sm mt-0.5">
            {products.length} products
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link href="/stock/reorder" className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors">
            <RefreshCcw className="h-3.5 w-3.5" />
            Reorder
          </Link>
          <Link href="/stock/valuation" className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors">
            <Layers className="h-3.5 w-3.5" />
            Valuation
          </Link>
          {canEdit && (
            <>
              <Link href="/stock/import" className={cn(buttonVariants({ variant: "outline" }), "border-slate-700 text-slate-300 hover:text-white h-9 text-sm")}>
                <Upload className="h-4 w-4 mr-1.5" />
                Import CSV
              </Link>
              <Link href="/stock/new" className={cn(buttonVariants(), "bg-blue-600 hover:bg-blue-500 h-9 text-sm")}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Product
              </Link>
            </>
          )}
        </div>
      </div>
      <StockList
        products={products}
        brands={brands}
        categories={categories}
        canEdit={canEdit}
        showCosts={session.role !== "SELLER"}
      />
    </div>
  );
}
