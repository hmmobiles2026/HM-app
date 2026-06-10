import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sales = await prisma.sale.findMany({
    include: {
      seller: { select: { name: true } },
      items: {
        include: {
          product: { include: { brand: true, model: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    ["Sale ID", "Date", "Seller", "Item Brand", "Item Model", "Item Name", "Qty", "Unit Price (LKR)", "Unit Cost (LKR)", "Total Revenue (LKR)", "Total Cost (LKR)", "Profit (LKR)", "Note"],
  ];

  for (const sale of sales) {
    if (sale.items.length === 0) {
      rows.push([
        sale.id,
        sale.createdAt.toISOString(),
        sale.seller.name,
        "", "", "", "", "", "",
        sale.totalRevenue.toNumber().toString(),
        sale.totalCost.toNumber().toString(),
        sale.profit.toNumber().toString(),
        sale.note ?? "",
      ]);
    } else {
      for (const item of sale.items) {
        rows.push([
          sale.id,
          sale.createdAt.toISOString(),
          sale.seller.name,
          item.product.brand.name,
          item.product.model?.name ?? "",
          item.product.name,
          item.quantity.toString(),
          item.unitPrice.toNumber().toString(),
          item.unitCost.toNumber().toString(),
          sale.totalRevenue.toNumber().toString(),
          sale.totalCost.toNumber().toString(),
          sale.profit.toNumber().toString(),
          sale.note ?? "",
        ]);
      }
    }
  }

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="hm-stocks-sales-${date}.csv"`,
    },
  });
}
