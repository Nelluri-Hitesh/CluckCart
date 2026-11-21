import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, ilike, or, sql, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, profiles } from "@/db/schema";
import { Badge, PageHeader, Table } from "@/components/admin-ui";
import { fmtDate, inr } from "@/lib/format";
import { setUserActive } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

export default async function CustomersAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim().replace(/[%_]/g, "");
  const rows = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      phone: profiles.phone,
      email: profiles.email,
      isActive: profiles.isActive,
      createdAt: profiles.createdAt,
      orders: sql<number>`count(${orders.id})::int`,
      spent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'cancelled'),0)::float`,
    })
    .from(profiles)
    .leftJoin(orders, eq(orders.userId, profiles.id))
    .where(and(eq(profiles.role, "customer"), term ? or(ilike(profiles.name, `%${term}%`), ilike(profiles.phone, `%${term}%`), ilike(profiles.email, `%${term}%`)) : undefined))
    .groupBy(profiles.id)
    .orderBy(desc(profiles.createdAt))
    .limit(300);
  return (
    <>
      <PageHeader title="Customers" subtitle={`${rows.length} shown`} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Search name, phone or email" className="input max-w-xs" aria-label="Search" /><button className="btn-dark">Search</button></form>
      <Table head={["Customer", "Contact", "Orders", "Spent", "Joined", "Status", ""]} empty={rows.length ? undefined : "No customers found"}>
        {rows.map((c) => (
          <tr key={c.id} className="hover:bg-surface/60">
            <td className="px-4 py-3 font-semibold"><Link href={`/admin/customers/${c.id}`} className="text-brand hover:underline">{c.name}</Link></td>
            <td className="px-4 py-3 text-muted">+91 {c.phone}<div className="text-xs">{c.email}</div></td>
            <td className="px-4 py-3">{c.orders}</td>
            <td className="px-4 py-3 font-bold">{inr(c.spent)}</td>
            <td className="px-4 py-3 text-muted">{fmtDate(c.createdAt)}</td>
            <td className="px-4 py-3">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Blocked</Badge>}</td>
            <td className="px-4 py-3 text-right"><form action={setUserActive.bind(null, c.id, !c.isActive)}><button className="btn-outline py-1.5 text-xs">{c.isActive ? "Block" : "Unblock"}</button></form></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
