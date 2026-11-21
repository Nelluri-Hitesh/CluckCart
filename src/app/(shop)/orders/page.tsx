import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { fmtDateTime, inr } from "@/lib/format";
import { STATUS_LABEL, statusTone } from "@/lib/order-status";
import { requirePage } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requirePage(["customer"], "/orders");
  const rows = await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(100);
  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db.select({ orderId: orderItems.orderId, name: orderItems.name, quantity: orderItems.quantity, n: sql<number>`1` }).from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  const byOrder = new Map<string, string[]>();
  for (const i of items) byOrder.set(i.orderId, [...(byOrder.get(i.orderId) ?? []), `${i.quantity}× ${i.name}`]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">My orders</h1>
      {rows.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-3xl">🍗</div>
          <h2 className="mt-4 text-lg font-bold">No orders yet</h2>
          <p className="mt-1 text-sm text-muted">Your orders will show up here once you place one.</p>
          <Link href="/products" className="btn-primary mt-5">Start shopping</Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="card block p-4 transition hover:shadow-md sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{o.orderNumber}</p>
                    <p className="text-xs text-muted">{fmtDateTime(o.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted">{(byOrder.get(o.id) ?? []).join(", ")}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">{o.paymentMethod === "cod" ? "Cash on delivery" : o.paymentStatus === "paid" ? "Paid online" : "Payment " + o.paymentStatus}</span>
                  <span className="text-base font-extrabold">{inr(o.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
