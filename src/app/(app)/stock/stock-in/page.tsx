import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { BulkStockInForm } from "./bulk-stock-in-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function BulkStockInPage() {
  await verifyRole(["ADMIN", "OWNER"]);

  const rawProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { brand: true, model: true },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
  });

  const products = rawProducts.map((p) => ({
    ...p,
    costPrice: p.costPrice.toNumber(),
    sellingPrice: p.sellingPrice.toNumber(),
  }));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <Link
          href="/stock"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Stock
        </Link>
        <h1 className="text-xl font-bold text-white">Stock In</h1>
        <p className="text-slate-400 text-sm mt-0.5">Add incoming stock across multiple products at once</p>
      </div>

      <BulkStockInForm products={products} />
    </div>
  );
}
