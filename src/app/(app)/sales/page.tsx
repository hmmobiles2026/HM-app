import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getCustomerBalanceMap, getSaleCreditMap } from "@/lib/customers";
import { getWarrantyDefaults } from "@/lib/warranty";
import { warrantyStatus, warrantyStatusLabel } from "@/lib/warranty-math";
import { format } from "date-fns";
import type { Prisma } from "@/generated/prisma/client";
import { QuickSaleForm } from "./quick-sale-form";
import { SalesHistory } from "./sales-history";
import { SupplierReturnsView } from "./supplier-returns-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VALID_TABS = ["new", "history", "supplier-returns"] as const;

/** Shared so the linked-sale lookup returns exactly the same shape as the list. */
const saleInclude = {
  seller: { select: { name: true } },
  customer: { select: { id: true, shopName: true } },
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
} satisfies Prisma.SaleInclude;

/**
 * Warranty badge text, resolved server-side so the client never redoes date maths.
 * Returns null when the line was sold without per-item cover.
 */
function warrantyLabelFor(
  perUnit: Prisma.Decimal | null,
  until: Date | null
): { covered: boolean; label: string; untilText: string } | null {
  if (!perUnit || perUnit.toNumber() <= 0 || !until) return null;
  const status = warrantyStatus(until);
  if (status.state === "none") return null;
  return {
    covered: status.state === "covered",
    label: status.state === "covered" ? warrantyStatusLabel(status) : "Warranty expired",
    untilText: format(new Date(until), "dd MMM yyyy"),
  };
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sale?: string }>;
}) {
  const { tab, sale: focusSaleId } = await searchParams;
  const defaultTab = VALID_TABS.includes(tab as (typeof VALID_TABS)[number])
    ? (tab as string)
    : focusSaleId
      ? "history"
      : "new";
  const session = await verifySession();
  const isAdminOrOwner = session.role !== "SELLER";
  const showFinancials = isAdminOrOwner;

  const [rawProducts, rawSales, suppliers, supplierReturns, rawCustomers, balances, warrantyDefaults] =
    await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, stockQty: { gt: 0 } },
      include: { brand: true, model: true, category: true, partBrand: true },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.sale.findMany({
      where: session.role === "SELLER" ? { sellerId: session.userId } : {},
      include: saleInclude,
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
                    partBrand: { select: { name: true } },
                  },
                },
                sale: { select: { id: true, createdAt: true } },
              },
            },
          },
          orderBy: [{ supplierStatus: "asc" }, { createdAt: "desc" }],
        })
      : [],
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { shopName: "asc" },
      select: { id: true, shopName: true, creditLimit: true },
    }),
    getCustomerBalanceMap(),
    getWarrantyDefaults(),
  ]);

  const customers = rawCustomers.map((c) => ({
    id: c.id,
    shopName: c.shopName,
    creditLimit: c.creditLimit ? c.creditLimit.toNumber() : null,
    // Absent from the map means they have never transacted.
    balance: balances.get(c.id) ?? 0,
  }));

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

  // A sale linked from a customer's ledger is often older than the 50 most recent,
  // so it would otherwise simply not be on the page. Fetch it and put it on top.
  // Sellers stay scoped to their own sales.
  const linkedSale =
    focusSaleId && !rawSales.some((s) => s.id === focusSaleId)
      ? await prisma.sale.findFirst({
          where: {
            id: focusSaleId,
            ...(session.role === "SELLER" ? { sellerId: session.userId } : {}),
          },
          include: saleInclude,
        })
      : null;

  const sourceSales = linkedSale ? [linkedSale, ...rawSales] : rawSales;

  // How much of each sale went on the tab that day (see getSaleCreditMap).
  const saleCredit = await getSaleCreditMap(
    sourceSales.filter((s) => s.customerId).map((s) => s.id)
  );

  const sales = sourceSales.map((s) => ({
    ...s,
    creditAtSale: saleCredit.get(s.id) ?? 0,
    totalRevenue: s.totalRevenue.toNumber(),
    totalCost: s.totalCost.toNumber(),
    profit: s.profit.toNumber(),
    warrantyFee: s.warrantyFee ? s.warrantyFee.toNumber() : null,
    items: s.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toNumber(),
      unitCost: item.unitCost.toNumber(),
      warrantyPerUnit: item.warrantyPerUnit ? item.warrantyPerUnit.toNumber() : null,
      // Resolved here on the server, not in the client component. warrantyStatus uses
      // local-time day arithmetic, so computing it during render would produce one
      // answer in the server's UTC and another in the browser's Asia/Colombo — a
      // hydration mismatch for any item sitting near a day boundary.
      warranty: warrantyLabelFor(item.warrantyPerUnit, item.warrantyUntil),
      returnedQty: item.returns.reduce((sum, r) => sum + r.quantity, 0),
    })),
  }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Sales</h1>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
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
          <QuickSaleForm products={products} customers={customers} warrantyDefaults={warrantyDefaults} />
        </TabsContent>
        <TabsContent value="history">
          <SalesHistory
            sales={sales}
            showFinancials={showFinancials}
            suppliers={suppliers}
            focusSaleId={linkedSale ? linkedSale.id : focusSaleId}
          />
        </TabsContent>
        {isAdminOrOwner && (
          <TabsContent value="supplier-returns">
            <SupplierReturnsView returns={returns} isAdmin={isAdminOrOwner} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
