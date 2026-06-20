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

function n(v: number) {
  return v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET() {
  const session = await verifySession();
  if (!["ADMIN", "OWNER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sales = await prisma.sale.findMany({
    include: {
      seller: { select: { name: true } },
      items: {
        include: {
          product: {
            include: { brand: true, model: true, partBrand: true },
          },
          returns: { select: { quantity: true, returnType: true, refundAmount: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: (string | number)[][] = [
    ["Sale Ref", "Date & Time", "Seller", "Brand", "Model", "Part Name", "Part Brand", "Qty Sold", "Qty Returned", "Unit Price (LKR)", "Unit Cost (LKR)", "Line Revenue (LKR)", "Line Cost (LKR)", "Line Profit (LKR)", "Sale Total Revenue (LKR)", "Sale Total Profit (LKR)", "Note"],
  ];

  for (const sale of sales) {
    const saleRef = sale.id.slice(-6).toUpperCase();
    const dt = slDateTime(sale.createdAt);
    const totalRev = sale.totalRevenue.toNumber();
    const totalProfit = sale.profit.toNumber();
    const note = sale.note ?? "";

    if (sale.items.length === 0) {
      rows.push([saleRef, dt, sale.seller.name, "", "", "", "", "", "", "", "", "", "", "", n(totalRev), n(totalProfit), note]);
    } else {
      for (const item of sale.items) {
        const qty = item.quantity;
        const returned = item.returns.reduce((s, r) => s + r.quantity, 0);
        const price = item.unitPrice.toNumber();
        const cost = item.unitCost.toNumber();
        const lineRev = price * qty;
        const lineCost = cost * qty;
        const p = item.product;
        const partLabel = [p.brand.name, p.model?.name].filter(Boolean).join(" ");
        rows.push([
          saleRef,
          dt,
          sale.seller.name,
          p.brand.name,
          p.model?.name ?? "",
          p.name,
          p.partBrand?.name ?? "",
          qty,
          returned > 0 ? returned : "",
          n(price),
          n(cost),
          n(lineRev),
          n(lineCost),
          n(lineRev - lineCost),
          n(totalRev),
          n(totalProfit),
          note,
        ]);
        void partLabel;
      }
    }
  }

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="HM-Stocks-Sales-${date}.csv"`,
    },
  });
}
