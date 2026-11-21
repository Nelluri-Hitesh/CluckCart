import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { Badge, PageHeader, Table } from "@/components/admin-ui";
import { fmtDateTime, inr } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/order-status";
import { expireStaleOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; payment?: string }> }) {
  await expireStaleOrders();
  const { q = "", status = "", payment = "" } = await searchParams;
  const term = q.trim().replace(/[%_]/g, "");
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        status ? eq(orders.status, status) : undefined,
        payment === "cod" || payment === "online" ? eq(orders.paymentMethod, payment) : payment === "paid" ? eq(orders.paymentStatus, "paid") : undefined,
        term ? or(ilike(orders.orderNumber, `%${term}%`), ilike(orders.customerName, `%${term}%`), ilike(orders.customerPhone, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(200);
  return (
    <>
      <PageHeader title="Orders" subtitle={`${rows.length} shown (latest 200)`}>
        <a href={`/api/admin/orders/export${status ? `?status=${status}` : ""}`} className="btn-outline">Export CSV</a>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search order no., name or phone" className="input max-w-xs" aria-label="Search" />
        <select name="status" defaultValue={status} className="input w-auto" aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="payment" defaultValue={payment} className="input w-auto" aria-label="Payment">
          <option value="">All payments</option>
          <option value="online">Online</option>
          <option value="cod">Cash on delivery</option>
          <option value="paid">Paid</option>
        </select>
        <button className="btn-dark">Filter</button>
        {(q || status || payment) && <Link href="/admin/orders" className="btn-outline">Reset</Link>}
      </form>
      <Table head={["Order", "Customer", "Placed", "Slot", "Status", "Payment", "Total"]} empty={rows.length ? undefined : "No orders match"}>
        {rows.map((o) => (
          <tr key={o.id} className="hover:bg-surface/60">
            <td className="px-4 py-3 font-semibold"><Link href={`/admin/orders/${o.id}`} className="text-brand hover:underline">{o.orderNumber}</Link></td>
            <td className="px-4 py-3">{o.customerName}<div className="text-xs text-muted">{o.customerPhone}</div></td>
            <td className="px-4 py-3 text-muted">{fmtDateTime(o.createdAt)}</td>
            <td className="px-4 py-3 text-muted">{o.deliveryDate}<div className="text-xs">{o.slotLabel}</div></td>
            <td className="px-4 py-3"><Badge tone={o.status === "delivered" ? "green" : o.status === "cancelled" ? "red" : "amber"}>{STATUS_LABEL[o.status]}</Badge></td>
            <td className="px-4 py-3"><Badge tone={o.paymentStatus === "paid" ? "green" : o.paymentStatus === "pending" ? "gray" : "red"}>{o.paymentMethod === "cod" ? "COD" : "Online"} · {o.paymentStatus}</Badge>{o.refundStatus !== "none" && <div className="mt-1"><Badge tone="blue">Refund {o.refundStatus}</Badge></div>}</td>
            <td className="px-4 py-3 font-bold">{inr(o.total)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
