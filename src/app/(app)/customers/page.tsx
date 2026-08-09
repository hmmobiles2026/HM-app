import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  getCustomerBalanceMap,
  getLastPaymentMap,
  getReceivablesSummary,
} from "@/lib/customers";
import { CustomersView } from "./customers-view";

export default async function CustomersPage() {
  const session = await verifySession();
  const canManage = session.role === "ADMIN" || session.role === "OWNER";

  const [rows, balances, lastPayments, summary] = await Promise.all([
    prisma.customer.findMany({ orderBy: { shopName: "asc" } }),
    getCustomerBalanceMap(),
    getLastPaymentMap(),
    getReceivablesSummary(),
  ]);

  const customers = rows
    .map((c) => ({
      id: c.id,
      shopName: c.shopName,
      ownerName: c.ownerName,
      phone: c.phone,
      address: c.address,
      note: c.note,
      isActive: c.isActive,
      creditLimit: c.creditLimit ? c.creditLimit.toNumber() : null,
      // Customers who have never transacted are absent from the map.
      balance: balances.get(c.id) ?? 0,
      lastPaymentAt: lastPayments.get(c.id) ?? null,
    }))
    // Biggest debt first — that is what the owner needs to act on.
    .sort((a, b) => b.balance - a.balance || a.shopName.localeCompare(b.shopName));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Customers</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Shops that buy on credit, and what they owe
        </p>
      </div>
      <CustomersView customers={customers} summary={summary} canManage={canManage} />
    </div>
  );
}
