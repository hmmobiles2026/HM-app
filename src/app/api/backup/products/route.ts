import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const SL_OFFSET = 5.5 * 60 * 60 * 1000;

function slDate(d: Date) {
  const sl = new Date(d.getTime() + SL_OFFSET);
  const dd = String(sl.getUTCDate()).padStart(2, "0");
  const mm = String(sl.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = sl.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const gradeLabel: Record<string, string> = {
  ORIGINAL: "Original",
  COPY_A: "Copy A",
  COPY_B: "Copy B",
  OTHER: "Other",
};

function n(v: number) {
  return v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET() {
  const session = await verifySession();
  if (!["ADMIN", "OWNER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    include: { brand: true, model: true, category: true, partBrand: true, supplier: true },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
  });

  const rows = [
    ["Brand", "Model", "Category", "Part Brand", "Part Name", "Quality", "Supplier", "Cost Price (LKR)", "Selling Price (LKR)", "Margin (LKR)", "Stock Qty", "Low Stock Alert", "Tags", "Active", "Added On"],
    ...products.map((p) => {
      const cost = p.costPrice.toNumber();
      const sell = p.sellingPrice.toNumber();
      return [
        p.brand.name,
        p.model?.name ?? "",
        p.category.name,
        p.partBrand?.name ?? "",
        p.name,
        gradeLabel[p.qualityGrade] ?? p.qualityGrade,
        p.supplier?.name ?? "",
        n(cost),
        n(sell),
        n(sell - cost),
        p.stockQty,
        p.lowStockThreshold,
        p.tags.join(", "),
        p.isActive ? "Yes" : "No",
        slDate(p.createdAt),
      ];
    }),
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="HM-Stocks-Products-${date}.csv"`,
    },
  });
}
