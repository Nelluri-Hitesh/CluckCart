import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses, orders, profiles } from "@/db/schema";
import { Badge, PageHeader, Table } from "@/components/admin-ui";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/order-status";
import { isUuid } from "@/lib/validation";
import { setUserActive } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer" };

export default async function CustomerAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [c] = await db.select().from(profiles).where(and(eq(profiles.id, id), eq(profiles.role, "customer"))).limit(1);
  if (!c) notFound();
  const [addresses, list] = await Promise.all([
    db.select().from(customerAddresses).where(eq(customerAddresses.userId, id)),
    db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)),
  ]);
  return (
    <>
      <PageHeader title={c.name} subtitle={`Customer since ${fmtDate(c.createdAt)}`}>
        <Link href="/admin/customers" className="btn-outline">← Customers</Link>
        <form action={setUserActive.bind(null, c.id, !c.isActive)}><button className="btn-dark">{c.isActive ? "Block account" : "Unblock account"}</button></form>
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5 text-sm shadow-sm">
          <h2 className="mb-2 font-extrabold">Account</h2>
          <p>+91 {c.phone}</p><p className="text-muted">{c.email ?? "No email"}</p>
          <div className="mt-2">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Blocked</Badge>}</div>
        </section>
        <section className="card p-5 text-sm shadow-sm lg:col-span-2">
          <h2 className="mb-2 font-extrabold">Saved addresses</h2>
          {addresses.length === 0 ? <p className="text-muted">None saved.</p> : (
            <ul className="space-y-2">{addresses.map((a) => <li key={a.id}><b>{a.label}</b> — {a.recipientName}, {[a.line1, a.area].filter(Boolean).join(", ")}, {a.city} {a.pincode}</li>)}</ul>
          )}
        </section>
      </div>
      <h2 className="mb-3 mt-6 font-extrabold">Orders ({list.length})</h2>
      <Table head={["Order", "Placed", "Status", "Total"]} empty={list.length ? undefined : "No orders yet"}>
        {list.map((o) => (
          <tr key={o.id}><td className="px-4 py-3 font-semibold"><Link className="text-brand hover:underline" href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link></td><td className="px-4 py-3 text-muted">{fmtDateTime(o.createdAt)}</td><td className="px-4 py-3">{STATUS_LABEL[o.status]}</td><td className="px-4 py-3 font-bold">{inr(o.total)}</td></tr>
        ))}
      </Table>
    </>
  );
}
