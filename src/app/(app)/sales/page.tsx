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
        items: { include: { product: { include: { brand: true, model: true } } } },
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
      product: {
        ...item.product,
        costPrice: item.product.costPrice.toNumber(),
        sellingPrice: item.product.sellingPrice.toNumber(),
      },
    })),
  }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Sales</h1>

      <Tabs defaultValue="new">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="new" className="data-[state=active]:bg-blue-600">
            New Sale
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-blue-600">
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
