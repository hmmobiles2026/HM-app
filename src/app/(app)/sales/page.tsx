import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { QuickSaleForm } from "./quick-sale-form";
import { SalesHistory } from "./sales-history";
import { SupplierReturnsView } from "./supplier-returns-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SalesPage() {
  const session = await verifySession();
  const showFinancials = session.role !== "SELLER";

  const isAdminOrOwner = session.role !== "SELLER";

  const [rawProducts, rawSales, suppliers, supplierReturns] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, stockQty: { gt: 0 } },
      include: { brand: true, model: true, category: true, partBrand: true },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.sale.findMany({
      where: session.role === "SELLER" ? { sellerId: session.userId } : {},
      include: {
        seller: { select: { name: true } },
        items: {
          include: {
            product: {
              select: {
                name: true,
                imageUrl: true,
                qualityGrade: true,
                brand: { select: { name: true } },
                model: { select: { name: true } },
                partBrand: { select: { name: true } },
              },
            },
            returns: { select: { quantity: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    isAdminOrOwner
      ? prisma.saleReturn.findMany({
          where: { returnType: "SUPPLIER_RETURN" },
          include: {
            supplier: { select: { name: true } },
            saleItem: {
              include: {
                product: {
                  select: {
                    name: true,
                    brand: { select: { name: true } },
                    model: { select: { name: true } },
                  },
                },
                sale: { select: { id: true, createdAt: true } },
              },
            },
          },
          orderBy: [{ supplierStatus: "asc" }, { createdAt: "desc" }],
        })
      : [],
  ]);

  const products = rawProducts.map((p) => ({
    ...p,
    costPrice: p.costPrice.toNumber(),
    sellingPrice: p.sellingPrice.toNumber(),
  }));

  const returns = Array.isArray(supplierReturns)
    ? supplierReturns.map((r) => ({
        ...r,
        costRecovery: r.costRecovery ? r.costRecovery.toNumber() : null,
        refundAmount: r.refundAmount.toNumber(),
      }))
    : [];

  const sales = rawSales.map((s) => ({
    ...s,
    totalRevenue: s.totalRevenue.toNumber(),
    totalCost: s.totalCost.toNumber(),
    profit: s.profit.toNumber(),
    items: s.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toNumber(),
      unitCost: item.unitCost.toNumber(),
      returnedQty: item.returns.reduce((sum, r) => sum + r.quantity, 0),
    })),
  }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Sales</h1>

      <Tabs defaultValue="new">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="new" className="text-white data-active:bg-blue-600 data-active:text-white">
            New Sale
          </TabsTrigger>
          <TabsTrigger value="history" className="text-white data-active:bg-blue-600 data-active:text-white">
            History
          </TabsTrigger>
          {isAdminOrOwner && (
            <TabsTrigger value="supplier-returns" className="text-white data-active:bg-amber-600 data-active:text-white">
              Supplier Returns
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="new">
          <QuickSaleForm products={products} />
        </TabsContent>
        <TabsContent value="history">
          <SalesHistory sales={sales} showFinancials={showFinancials} suppliers={suppliers} />
        </TabsContent>
        {isAdminOrOwner && (
          <TabsContent value="supplier-returns">
            <SupplierReturnsView returns={returns} isAdmin={session.role === "ADMIN"} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
