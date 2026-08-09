import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getCustomerSummary, getCustomerLedger } from "@/lib/customers";
import { CustomerDetailView } from "./customer-detail-view";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();
  const canManage = session.role === "ADMIN" || session.role === "OWNER";

  const [customer, summary, ledger] = await Promise.all([
    prisma.customer.findUnique({ where: { id } }),
    getCustomerSummary(id),
    getCustomerLedger(id),
  ]);

  if (!customer) notFound();

  return (
    <CustomerDetailView
      customer={{
        id: customer.id,
        shopName: customer.shopName,
        ownerName: customer.ownerName,
        phone: customer.phone,
        address: customer.address,
        note: customer.note,
        isActive: customer.isActive,
        creditLimit: customer.creditLimit ? customer.creditLimit.toNumber() : null,
      }}
      summary={summary}
      ledger={ledger}
      canManage={canManage}
    />
  );
}
