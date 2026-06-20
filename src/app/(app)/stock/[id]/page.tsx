import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "../product-form";
import { StockHistory } from "./stock-history";
import { PriceHistory } from "./price-history";
import { StockInForm } from "./stock-in-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await verifySession();

  const [product, brands, categories, suppliers, movements, priceEntries] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { brand: true, model: true, category: true, partBrand: true, supplier: true },
    }),
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
    prisma.stockMovement.findMany({
      where: { productId: id },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.priceHistory.findMany({
      where: { productId: id },
      orderBy: { changedAt: "desc" },
      take: 20,
    }),
  ]);

  if (!product || !product.isActive) notFound();

  const serializedProduct = {
    ...product,
    costPrice: product.costPrice.toNumber(),
    sellingPrice: product.sellingPrice.toNumber(),
    partBrand: product.partBrand ?? null,
    supplier: product.supplier ?? null,
  };

  const serializedPriceEntries = priceEntries.map((e) => ({
    ...e,
    oldCostPrice: e.oldCostPrice.toNumber(),
    newCostPrice: e.newCostPrice.toNumber(),
    oldSellPrice: e.oldSellPrice.toNumber(),
    newSellPrice: e.newSellPrice.toNumber(),
  }));

  const canEdit = session.role === "ADMIN" || session.role === "OWNER";
  const showCosts = session.role !== "SELLER";

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">
          {product.brand.name}
          {product.model ? ` ${product.model.name}` : ""} — {product.name}
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Current stock:{" "}
          <span
            className={
              product.stockQty <= product.lowStockThreshold
                ? "text-amber-400 font-semibold"
                : "text-white font-semibold"
            }
          >
            {product.stockQty} units
          </span>
        </p>
      </div>

      <Tabs defaultValue={tab === "stock-in" && canEdit ? "stock-in" : canEdit ? "edit" : "history"}>
        <TabsList className="bg-slate-900 border border-slate-800">
          {canEdit && (
            <TabsTrigger value="edit" className="text-white data-active:bg-blue-600 data-active:text-white">
              Edit Product
            </TabsTrigger>
          )}
          {canEdit && (
            <TabsTrigger value="stock-in" className="text-white data-active:bg-blue-600 data-active:text-white">
              Add Stock
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="text-white data-active:bg-blue-600 data-active:text-white">
            History
          </TabsTrigger>
          {showCosts && (
            <TabsTrigger value="prices" className="text-white data-active:bg-blue-600 data-active:text-white">
              Prices
            </TabsTrigger>
          )}
        </TabsList>

        {canEdit && (
          <TabsContent value="edit">
            <ProductForm
              brands={brands}
              categories={categories}
              suppliers={suppliers}
              product={serializedProduct}
              showCosts={showCosts}
            />
          </TabsContent>
        )}
        {canEdit && (
          <TabsContent value="stock-in">
            <StockInForm productId={product.id} suppliers={suppliers} />
          </TabsContent>
        )}
        <TabsContent value="history">
          <StockHistory movements={movements} showCosts={showCosts} />
        </TabsContent>
        {showCosts && (
          <TabsContent value="prices">
            <PriceHistory
              entries={serializedPriceEntries}
              currentCost={serializedProduct.costPrice}
              currentSell={serializedProduct.sellingPrice}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
