import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    include: { brand: true, model: true, category: true },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
  });

  const rows = [
    ["ID", "Brand", "Model", "Category", "Name", "Grade", "Cost (LKR)", "Price (LKR)", "Stock", "Low Threshold", "Tags", "Description", "Image URL", "Active", "Created At"],
    ...products.map((p) => [
      p.id,
      p.brand.name,
      p.model?.name ?? "",
      p.category.name,
      p.name,
      p.qualityGrade,
      p.costPrice.toNumber(),
      p.sellingPrice.toNumber(),
      p.stockQty,
      p.lowStockThreshold,
      p.tags.join("|"),
      p.description ?? "",
      p.imageUrl ?? "",
      p.isActive ? "Yes" : "No",
      p.createdAt.toISOString(),
    ]),
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="hm-stocks-products-${date}.csv"`,
    },
  });
}
