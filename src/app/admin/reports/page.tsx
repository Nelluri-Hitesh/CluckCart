import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PageHeader, StatCard, Table } from "@/components/admin-ui";
import { BarChart } from "@/components/charts";
import { addDays, inr, istNow, weightLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports" };

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: d } = await searchParams;
  const days = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  const today = istNow().date;
  const since = new Date(`${addDays(today, -(days - 1))}T00:00:00+05:30`).toISOString();

  const [daily, byCat, top, methods, totals] = await Promise.all([
    db.execute<{ d: string; s: number }>(sql`select to_char(created_at at time zone 'Asia/Kolkata','YYYY-MM-DD') d, sum(total)::float s from orders where status <> 'cancelled' and created_at >= ${since}::timestamptz group by 1`),
    db.execute<{ name: string; kg: number; rev: number }>(sql`select c.name, (sum(oi.grams * oi.quantity)/1000.0)::float kg, sum(oi.line_total)::float rev from order_items oi join orders o on o.id = oi.order_id join products p on p.id = oi.product_id join categories c on c.id = p.category_id where o.status <> 'cancelled' and o.created_at >= ${since}::timestamptz group by c.name order by rev desc`),
    db.execute<{ name: string; grams: number; rev: number }>(sql`select oi.name, sum(oi.grams * oi.quantity)::int grams, sum(oi.line_total)::float rev from order_items oi join orders o on o.id = oi.order_id where o.status <> 'cancelled' and o.created_at >= ${since}::timestamptz group by oi.name order by rev desc limit 10`),
    db.execute<{ m: string; n: number; rev: number }>(sql`select payment_method m, count(*)::int n, coalesce(sum(total),0)::float rev from orders where status <> 'cancelled' and created_at >= ${since}::timestamptz group by 1`),
    db.execute<{ orders: number; revenue: number; discount: number; delivery: number; cancelled: number; refunded: number }>(sql`select count(*) filter (where status <> 'cancelled')::int orders, coalesce(sum(total) filter (where status <> 'cancelled'),0)::float revenue, coalesce(sum(discount) filter (where status <> 'cancelled'),0)::float discount, coalesce(sum(delivery_fee) filter (where status <> 'cancelled'),0)::float delivery, count(*) filter (where status = 'cancelled')::int cancelled, (select coalesce(sum(amount),0)::float from refunds where status = 'processed' and created_at >= ${since}::timestamptz) refunded from orders where created_at >= ${since}::timestamptz`),
  ]);
  const t = totals.rows[0];
  const map = new Map(daily.rows.map((r) => [r.d, r.s]));
  const chart = Array.from({ length: days }, (_, i) => {
    const dt = addDays(today, i - (days - 1));
    return { label: dt.slice(8), value: map.get(dt) ?? 0 };
  });
  return (
    <>
      <PageHeader title="Sales reports" subtitle={`Last ${days} days (IST)`}>
        {[7, 30, 90].map((n) => <a key={n} href={`?days=${n}`} className={`chip ${n === days ? "chip-active" : ""}`}>{n} days</a>)}
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={inr(t.revenue)} tone="good" />
        <StatCard label="Orders" value={t.orders} />
        <StatCard label="Avg. order" value={inr(t.orders ? t.revenue / t.orders : 0)} />
        <StatCard label="Discounts given" value={inr(t.discount)} />
        <StatCard label="Cancelled" value={t.cancelled} />
        <StatCard label="Refunded" value={inr(t.refunded)} />
      </div>
      <section className="card mt-5 p-5 shadow-sm"><h2 className="mb-3 font-extrabold">Daily sales</h2><BarChart data={chart} height={200} /></section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section><h2 className="mb-3 font-extrabold">By category</h2>
          <Table head={["Category", "Weight sold", "Revenue"]} empty={byCat.rows.length ? undefined : "No sales in this period"}>
            {byCat.rows.map((r) => <tr key={r.name}><td className="px-4 py-3 font-semibold">{r.name}</td><td className="px-4 py-3 text-muted">{r.kg.toFixed(1)} kg</td><td className="px-4 py-3 font-bold">{inr(r.rev)}</td></tr>)}
          </Table></section>
        <section><h2 className="mb-3 font-extrabold">Top products</h2>
          <Table head={["Product", "Weight sold", "Revenue"]} empty={top.rows.length ? undefined : "No sales in this period"}>
            {top.rows.map((r) => <tr key={r.name}><td className="px-4 py-3 font-semibold">{r.name}</td><td className="px-4 py-3 text-muted">{weightLabel(r.grams)}</td><td className="px-4 py-3 font-bold">{inr(r.rev)}</td></tr>)}
          </Table></section>
      </div>
      <section className="mt-5"><h2 className="mb-3 font-extrabold">Payment methods</h2>
        <Table head={["Method", "Orders", "Revenue"]} empty={methods.rows.length ? undefined : "No sales in this period"}>
          {methods.rows.map((r) => <tr key={r.m}><td className="px-4 py-3 font-semibold">{r.m === "cod" ? "Cash on delivery" : "Online"}</td><td className="px-4 py-3">{r.n}</td><td className="px-4 py-3 font-bold">{inr(r.rev)}</td></tr>)}
        </Table></section>
    </>
  );
}
