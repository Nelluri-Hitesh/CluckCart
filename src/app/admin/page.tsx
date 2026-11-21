import Link from "next/link";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, profiles } from "@/db/schema";
import { Badge, PageHeader, StatCard, Table } from "@/components/admin-ui";
import { BarChart } from "@/components/charts";
import { getProducts } from "@/lib/catalog";
import { addDays, fmtDateTime, inr, istNow, weightLabel } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/order-status";
import { expireStaleOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

const PENDING = ["placed", "payment_confirmed", "accepted", "preparing", "ready_for_dispatch", "out_for_delivery"];

export default async function AdminDashboard() {
  await expireStaleOrders();
  const today = istNow().date;
  const todayStart = new Date(`${today}T00:00:00+05:30`);
  const since = new Date(`${addDays(today, -13)}T00:00:00+05:30`);

  const [[sales], [counts], [custCount], daily, recent, products] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${orders.total}),0)::float`, n: sql<number>`count(*)::int` }).from(orders).where(and(sql`${orders.createdAt} >= ${todayStart.toISOString()}::timestamptz`, ne(orders.status, "cancelled"))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${orders.status} in ('placed','payment_confirmed','accepted','preparing','ready_for_dispatch','out_for_delivery'))::int`,
        done: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
        cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
      })
      .from(orders),
    db.select({ n: sql<number>`count(*)::int` }).from(profiles).where(eq(profiles.role, "customer")),
    db.execute<{ d: string; s: number }>(sql`select to_char(created_at at time zone 'Asia/Kolkata','YYYY-MM-DD') as d, sum(total)::float as s from orders where status <> 'cancelled' and created_at >= ${since.toISOString()}::timestamptz group by 1`),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    getProducts({ includeInactive: true }),
  ]);

  const byDay = new Map(daily.rows.map((r) => [r.d, r.s]));
  const chart = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13);
    return { label: d.slice(8), value: byDay.get(d) ?? 0 };
  });
  const active = products.filter((p) => p.isActive);
  const available = active.filter((p) => p.inStock).length;
  const low = active.filter((p) => p.stockGrams <= p.lowStockGrams);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Overview for ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Today's sales" value={inr(sales.total)} hint={`${sales.n} orders today`} tone="good" />
        <StatCard label="Total orders" value={counts.total} />
        <StatCard label="Pending orders" value={counts.pending} tone={counts.pending ? "warn" : "default"} hint="Need action" />
        <StatCard label="Completed" value={counts.done} />
        <StatCard label="Cancelled" value={counts.cancelled} />
        <StatCard label="Customers" value={custCount.n} />
        <StatCard label="Available products" value={`${available}/${active.length}`} />
        <StatCard label="Low stock" value={low.length} tone={low.length ? "warn" : "default"} hint="At or below alert level" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <section className="card p-5 shadow-sm xl:col-span-2">
          <h2 className="font-extrabold">Sales — last 14 days</h2>
          <p className="mb-3 text-xs text-muted">Excludes cancelled orders · day of month on the axis</p>
          <BarChart data={chart} />
        </section>
        <section className="card p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="font-extrabold">Low-stock products</h2><Link href="/admin/inventory" className="text-xs font-semibold text-brand">Manage</Link></div>
          {low.length === 0 ? <p className="mt-4 text-sm text-muted">All products are well stocked.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {low.slice(0, 7).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm"><span className="font-medium">{p.name}</span><Badge tone={p.stockGrams < p.minGrams ? "red" : "amber"}>{p.stockGrams < p.minGrams ? "Out" : weightLabel(p.stockGrams)}</Badge></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">Recent orders</h2><Link href="/admin/orders" className="text-sm font-semibold text-brand">View all</Link></div>
        <Table head={["Order", "Customer", "Placed", "Status", "Payment", "Total"]} empty={recent.length ? undefined : "No orders yet"}>
          {recent.map((o) => (
            <tr key={o.id} className="hover:bg-surface/60">
              <td className="px-4 py-3 font-semibold"><Link href={`/admin/orders/${o.id}`} className="text-brand hover:underline">{o.orderNumber}</Link></td>
              <td className="px-4 py-3">{o.customerName}</td>
              <td className="px-4 py-3 text-muted">{fmtDateTime(o.createdAt)}</td>
              <td className="px-4 py-3"><Badge tone={PENDING.includes(o.status) ? "amber" : o.status === "delivered" ? "green" : "red"}>{STATUS_LABEL[o.status]}</Badge></td>
              <td className="px-4 py-3 text-muted">{o.paymentMethod === "cod" ? "COD" : "Online"} · {o.paymentStatus}</td>
              <td className="px-4 py-3 font-bold">{inr(o.total)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
