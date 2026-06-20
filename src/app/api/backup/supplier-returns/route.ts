import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const SL_OFFSET = 5.5 * 60 * 60 * 1000;

function slDateTime(d: Date) {
  const sl = new Date(d.getTime() + SL_OFFSET);
  const dd = String(sl.getUTCDate()).padStart(2, "0");
  const mm = String(sl.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = sl.getUTCFullYear();
  const hh = String(sl.getUTCHours()).padStart(2, "0");
  const min = String(sl.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function slDate(d: Date) {
  const sl = new Date(d.getTime() + SL_OFFSET);
  const dd = String(sl.getUTCDate()).padStart(2, "0");
  const mm = String(sl.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = sl.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function n(v: number) {
  return v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET() {
  const session = await verifySession();
  if (!["ADMIN", "OWNER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const returns = await prisma.saleReturn.findMany({
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
    orderBy: { createdAt: "desc" },
  });

  const rows: (string | number)[][] = [
    [
      "Return Date",
      "Sale Ref",
      "Brand",
      "Model",
      "Part Name",
      "Part Brand",
      "Supplier",
      "Qty",
      "Cost Recovery (LKR)",
      "Reason",
      "Status",
      "Date Returned to Supplier",
    ],
  ];

  for (const r of returns) {
    const p = r.saleItem.product;
    rows.push([
      slDateTime(r.createdAt),
      r.saleItem.sale.id.slice(-6).toUpperCase(),
      p.brand.name,
      p.model?.name ?? "",
      p.name,
      p.partBrand?.name ?? "",
      r.supplier?.name ?? "",
      r.quantity,
      r.costRecovery ? n(r.costRecovery.toNumber()) : "",
      r.reason,
      r.supplierStatus === "RESOLVED" ? "Returned" : "Pending",
      r.resolvedAt ? slDate(r.resolvedAt) : "",
    ]);
  }

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="HM-Stocks-Supplier-Returns-${date}.csv"`,
    },
  });
}
