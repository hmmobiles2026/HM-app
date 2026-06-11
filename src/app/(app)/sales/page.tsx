import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { QuickSaleForm } from "./quick-sale-form";
import { SalesHistory } from "./sales-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SalesPage() {
  const session = await verifySession();
  const showFinancials = session.role !== "SELLER";

  const [rawProducts, rawSales] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, stockQty: { gt: 0 } },
      include: { brand: true, model: true, category: true },
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
              },
            },
            returns: { select: { quantity: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const products = rawProducts.map((p) => ({
    ...p,
    costPrice: p.costPrice.toNumber(),
    sellingPrice: p.sellingPrice.toNumber(),
  }));

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
        </TabsList>
        <TabsContent value="new">
          <QuickSaleForm products={products} />
        </TabsContent>
        <TabsContent value="history">
          <SalesHistory sales={sales} showFinancials={showFinancials} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
