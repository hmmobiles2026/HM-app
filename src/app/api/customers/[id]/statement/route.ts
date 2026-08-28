import { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { LEDGER_SIGN, roundMoney } from "@/lib/credit-math";

/**
 * Printable statement of account for one customer.
 *
 * Answers the question a shop actually asks: "how did I end up owing this?" Every
 * charge is broken down to the parts, quantities and prices they were charged, with a
 * running balance, so the total can be checked line by line.
 *
 * Deliberately contains no cost or profit figures — this document is handed to the
 * customer.
 */

// ── Shop and maker details. Edit these two blocks to rebrand the document. ──
const SHOP = {
  name: "HM Stocks",
  tagline: "Mobile Phone Parts",
};
const MAKER = {
  name: "Heshan Kavinda",
  product: "POS Systems",
  contact: "kavindesh518716@gmail.com",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const money = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const day = (d: Date) =>
  new Date(d).toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" });

function partLabel(p: {
  name: string;
  brand: { name: string };
  model: { name: string } | null;
  partBrand: { name: string } | null;
}) {
  const head = `${p.brand.name}${p.model ? ` ${p.model.name}` : ""}`;
  return `${head} — ${p.name}${p.partBrand ? ` (${p.partBrand.name})` : ""}`;
}

const typeName: Record<string, string> = {
  CHARGE: "Goods supplied",
  PAYMENT: "Payment received",
  RETURN_CREDIT: "Returned goods",
  ADJUSTMENT: "Adjustment",
};

const methodName: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifySession();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return new Response("Customer not found", { status: 404 });

  const entries = await prisma.customerLedger.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "asc" },
  });

  const saleIds = [...new Set(entries.filter((e) => e.saleId).map((e) => e.saleId!))];
  const returnIds = [...new Set(entries.filter((e) => e.returnId).map((e) => e.returnId!))];

  const [sales, returns] = await Promise.all([
    saleIds.length
      ? prisma.sale.findMany({
          where: { id: { in: saleIds } },
          include: {
            items: {
              include: { product: { include: { brand: true, model: true, partBrand: true } } },
            },
          },
        })
      : [],
    returnIds.length
      ? prisma.saleReturn.findMany({
          where: { id: { in: returnIds } },
          include: {
            saleItem: {
              include: { product: { include: { brand: true, model: true, partBrand: true } } },
            },
          },
        })
      : [],
  ]);

  const saleById = new Map(sales.map((s) => [s.id, s]));
  const returnById = new Map(returns.map((r) => [r.id, r]));

  // ── Rows ──────────────────────────────────────────────────────────────────
  let running = 0;
  let charged = 0;
  let paid = 0;
  let credited = 0;
  // Signed: a correction can push the balance either way. Leaving these out of the
  // summary made the printed totals disagree with the balance, which is the first
  // thing a customer would query.
  let adjusted = 0;

  const rows = entries.map((e) => {
    const amount = e.amount.toNumber();
    running = roundMoney(running + LEDGER_SIGN[e.type] * amount);

    if (e.type === "CHARGE") charged += amount;
    if (e.type === "PAYMENT") paid += amount;
    if (e.type === "RETURN_CREDIT") credited += amount;
    if (e.type === "ADJUSTMENT") adjusted += amount;

    const increases = e.type === "CHARGE" || (e.type === "ADJUSTMENT" && amount > 0);
    let detail = "";

    if (e.type === "CHARGE" && e.saleId) {
      const sale = saleById.get(e.saleId);
      const ref = e.saleId.slice(-6).toUpperCase();
      const lines = (sale?.items ?? [])
        .map((it) => {
          const unit = it.unitPrice.toNumber();
          const qty = it.quantity;
          const warranty = it.warrantyPerUnit ? it.warrantyPerUnit.toNumber() : 0;
          const warrantyNote = warranty
            ? `<div class="warranty">+ warranty ${money(warranty)} × ${qty}${
                it.warrantyMonths ? ` · ${it.warrantyMonths} month cover` : ""
              }</div>`
            : "";
          return `<tr class="part">
              <td class="pname">${esc(partLabel(it.product))}${warrantyNote}</td>
              <td class="pqty">${qty}</td>
              <td class="pprice">${money(unit)}</td>
              <td class="pline">${money(roundMoney(unit * qty))}</td>
            </tr>`;
        })
        .join("");

      const wf = sale?.warrantyFee ? sale.warrantyFee.toNumber() : 0;
      const warrantyRow = wf
        ? `<tr class="part"><td class="pname"><em>Warranty charged on this bill</em></td><td class="pqty"></td><td class="pprice"></td><td class="pline">${money(wf)}</td></tr>`
        : "";

      detail = `<div class="ref">Bill #${ref}</div>
        <table class="parts">
          <tr class="phead"><th>Item</th><th class="pqty">Qty</th><th class="pprice">Unit price</th><th class="pline">Total</th></tr>
          ${lines || `<tr class="part"><td colspan="4"><em>No item detail recorded</em></td></tr>`}
          ${warrantyRow}
        </table>`;
    } else if (e.type === "RETURN_CREDIT" && e.returnId) {
      const r = returnById.get(e.returnId);
      const ref = e.saleId ? ` from bill #${e.saleId.slice(-6).toUpperCase()}` : "";
      detail = r
        ? `<div class="ref">Returned${esc(ref)}</div>
           <table class="parts">
             <tr class="part">
               <td class="pname">${esc(partLabel(r.saleItem.product))}${r.reason ? `<div class="warranty">Reason: ${esc(r.reason)}</div>` : ""}</td>
               <td class="pqty">${r.quantity}</td>
               <td class="pprice">${money(r.saleItem.unitPrice.toNumber())}</td>
               <td class="pline">${money(amount)}</td>
             </tr>
           </table>`
        : `<div class="ref">Returned goods${esc(ref)}</div>`;
    } else if (e.type === "PAYMENT") {
      detail = `<div class="ref">${esc(e.method ? methodName[e.method] ?? e.method : "Payment")}</div>`;
      if (e.note) detail += `<div class="warranty">${esc(e.note)}</div>`;
    } else if (e.note) {
      detail = `<div class="warranty">${esc(e.note)}</div>`;
    }

    return `<tr class="entry">
      <td class="date">${day(e.createdAt)}</td>
      <td class="kind"><span class="tag ${e.type.toLowerCase()}">${typeName[e.type] ?? e.type}</span>${detail}</td>
      <td class="amt ${increases ? "up" : "down"}">${increases ? "+" : "−"}${money(Math.abs(amount))}</td>
      <td class="bal">${money(running)}</td>
    </tr>`;
  });

  const outstanding = running;
  const generated = new Date().toLocaleString("en-LK", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statement — ${esc(customer.shopName)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f2f4f6; color:#15202b; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size:12px; line-height:1.5; }
  .sheet { max-width: 820px; margin: 16px auto; background:#fff; padding: 28px 30px 22px; box-shadow: 0 1px 4px rgba(0,0,0,.12); }

  .top { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:2px solid #15202b; padding-bottom:14px; }
  .shop { font-size:21px; font-weight:800; letter-spacing:-.02em; margin:0; }
  .tagline { color:#66757f; font-size:11px; margin:2px 0 0; }
  .doctitle { text-align:right; }
  .doctitle h2 { margin:0; font-size:15px; letter-spacing:.14em; text-transform:uppercase; color:#0b6e7f; }
  .doctitle p { margin:3px 0 0; color:#66757f; font-size:11px; }

  .to { display:flex; justify-content:space-between; gap:20px; margin:16px 0 18px; }
  .to .label { font-size:9.5px; letter-spacing:.13em; text-transform:uppercase; color:#8c99a3; margin:0 0 3px; }
  .to .who { font-size:15px; font-weight:700; margin:0; }
  .to .sub { color:#66757f; margin:1px 0 0; }

  .cards { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px; }
  .card { min-width:120px; }
  .card { flex:1; border:1px solid #dfe5e9; border-radius:4px; padding:9px 11px; }
  .card.due { border-color:#0b6e7f; background:#f0f8f9; }
  .card .k { font-size:9.5px; letter-spacing:.11em; text-transform:uppercase; color:#8c99a3; }
  .card .v { font-size:16px; font-weight:750; margin-top:2px; font-variant-numeric: tabular-nums; }
  .card.due .v { color:#0b6e7f; }

  table.ledger { width:100%; border-collapse:collapse; }
  table.ledger > thead th { text-align:left; font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:#8c99a3; border-bottom:1.5px solid #cfd8dd; padding:0 8px 6px 0; }
  th.amt, th.bal, td.amt, td.bal { text-align:right; }
  tr.entry > td { border-bottom:1px solid #e6ebee; padding:9px 8px 9px 0; vertical-align:top; page-break-inside:avoid; }
  td.date { white-space:nowrap; color:#4a5a66; width:78px; }
  td.amt, td.bal { white-space:nowrap; font-variant-numeric: tabular-nums; width:92px; }
  td.amt.up { color:#1d4ed8; } td.amt.down { color:#0f7a45; }
  td.bal { font-weight:700; }

  .tag { display:inline-block; font-size:9.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; padding:1px 6px; border-radius:3px; margin-bottom:5px; }
  .tag.charge { background:#e6effd; color:#1d4ed8; }
  .tag.payment { background:#e3f4ea; color:#0f7a45; }
  .tag.return_credit { background:#fdf0e0; color:#9a5b0a; }
  .tag.adjustment { background:#f0eafb; color:#6b3fb5; }
  .ref { font-weight:650; }
  .warranty { color:#78868f; font-size:11px; }

  table.parts { width:100%; border-collapse:collapse; margin-top:5px; }
  table.parts .phead th { font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:#9aa6ae; font-weight:600; padding:0 6px 2px 0; border-bottom:1px solid #eef2f4; }
  table.parts td { padding:2px 6px 2px 0; border:none; font-size:11.5px; }
  .pqty, .pprice, .pline { text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums; }
  .pqty { width:38px; } .pprice { width:80px; } .pline { width:82px; font-weight:600; }
  .pname { color:#2c3a44; }

  .totals { margin-top:16px; display:flex; justify-content:flex-end; }
  .totals table { border-collapse:collapse; min-width:280px; }
  .totals td { padding:5px 0; font-variant-numeric: tabular-nums; }
  .totals td.k { color:#66757f; padding-right:26px; }
  .totals td.v { text-align:right; font-weight:650; }
  .totals tr.grand td { border-top:2px solid #15202b; padding-top:8px; font-size:15px; font-weight:800; }
  .totals tr.grand td.v { color:#0b6e7f; }

  .note { margin-top:18px; border-left:3px solid #0b6e7f; background:#f4f9fa; padding:9px 12px; color:#3d4d57; }

  .foot { margin-top:22px; border-top:1px solid #dfe5e9; padding-top:10px; display:flex; justify-content:space-between; gap:16px; color:#8c99a3; font-size:10px; }
  .maker { text-align:right; }
  .maker b { color:#15202b; font-size:10.5px; }

  .bar { max-width:820px; margin:14px auto 0; display:flex; gap:8px; justify-content:flex-end; }
  .bar button { font: inherit; font-weight:650; padding:8px 16px; border-radius:4px; border:1px solid #0b6e7f; background:#0b6e7f; color:#fff; cursor:pointer; }
  @media print { .bar { display:none; } body { background:#fff; } .sheet { box-shadow:none; margin:0; max-width:none; padding:0; } }
</style></head>
<body>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">

  <div class="top">
    <div>
      <p class="shop">${esc(SHOP.name)}</p>
      <p class="tagline">${esc(SHOP.tagline)}</p>
    </div>
    <div class="doctitle">
      <h2>Statement of Account</h2>
      <p>Generated ${esc(generated)}</p>
    </div>
  </div>

  <div class="to">
    <div>
      <p class="label">Statement for</p>
      <p class="who">${esc(customer.shopName)}</p>
      <p class="sub">${esc([customer.ownerName, customer.phone].filter(Boolean).join(" · ") || "—")}</p>
      ${customer.address ? `<p class="sub">${esc(customer.address)}</p>` : ""}
    </div>
    <div style="text-align:right">
      <p class="label">Entries</p>
      <p class="who">${entries.length}</p>
      <p class="sub">${entries.length ? `${day(entries[0].createdAt)} – ${day(entries[entries.length - 1].createdAt)}` : "No activity"}</p>
    </div>
  </div>

  <div class="cards">
    <div class="card"><div class="k">Goods supplied</div><div class="v">${money(roundMoney(charged))}</div></div>
    <div class="card"><div class="k">Payments received</div><div class="v">${money(roundMoney(paid))}</div></div>
    <div class="card"><div class="k">Returns credited</div><div class="v">${money(roundMoney(credited))}</div></div>
    ${
      roundMoney(adjusted) !== 0
        ? `<div class="card"><div class="k">Adjustments</div><div class="v">${adjusted < 0 ? "−" : "+"}${money(Math.abs(roundMoney(adjusted)))}</div></div>`
        : ""
    }
    <div class="card due"><div class="k">${outstanding < 0 ? "Paid in advance" : "Balance due"}</div><div class="v">${money(Math.abs(outstanding))}</div></div>
  </div>

  <table class="ledger">
    <thead><tr><th>Date</th><th>Details</th><th class="amt">Amount</th><th class="bal">Balance</th></tr></thead>
    <tbody>
      ${rows.join("") || `<tr class="entry"><td colspan="4"><em>No transactions recorded.</em></td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td class="k">Goods supplied</td><td class="v">${money(roundMoney(charged))}</td></tr>
      ${
        roundMoney(adjusted) !== 0
          ? `<tr><td class="k">Adjustments</td><td class="v">${adjusted < 0 ? "− " : "+ "}${money(Math.abs(roundMoney(adjusted)))}</td></tr>`
          : ""
      }
      <tr><td class="k">Less payments received</td><td class="v">− ${money(roundMoney(paid))}</td></tr>
      <tr><td class="k">Less returns credited</td><td class="v">− ${money(roundMoney(credited))}</td></tr>
      <tr class="grand"><td class="k">${outstanding < 0 ? "Paid in advance" : "Balance due"}</td><td class="v">LKR ${money(Math.abs(outstanding))}</td></tr>
    </table>
  </div>

  <div class="note">
    All amounts in Sri Lankan Rupees. Unit prices shown are the agreed prices charged on
    each bill. If anything here does not match your records, please contact us before
    settling.
  </div>

  <div class="foot">
    <div>${esc(SHOP.name)} · Statement for ${esc(customer.shopName)}</div>
    <div class="maker">
      <b>${esc(MAKER.name)}</b> · ${esc(MAKER.product)}<br>
      ${esc(MAKER.contact)}
    </div>
  </div>

</div>
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
