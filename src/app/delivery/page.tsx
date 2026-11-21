import Link from "next/link";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveryAssignments, orders } from "@/db/schema";
import { Badge } from "@/components/admin-ui";
import { inr } from "@/lib/format";
import { requirePage } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DeliveryHome() {
  const user = await requirePage(["delivery"], "/delivery");
  const rows = await db
    .select({
      a: deliveryAssignments,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      method: orders.paymentMethod,
      slot: orders.slotLabel,
      date: orders.deliveryDate,
      area: sql<string>`coalesce(${orders.address}->>'area', ${orders.address}->>'city')`,
      pin: sql<string>`${orders.address}->>'pincode'`,
    })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
    .where(and(eq(deliveryAssignments.staffId, user.id), inArray(deliveryAssignments.status, ["assigned", "accepted", "out_for_delivery"])))
    .orderBy(asc(orders.deliveryDate), asc(orders.slotLabel));

  return (
    <>
      <h1 className="text-xl font-extrabold">My deliveries</h1>
      <p className="mb-4 text-sm text-muted">{rows.length} active</p>
      {rows.length === 0 ? (
        <div className="mt-16 text-center"><div className="text-5xl">🛵</div><p className="mt-3 font-bold">No deliveries assigned</p><p className="text-sm text-muted">New assignments will appear here.</p></div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.a.id}>
              <Link href={`/delivery/${r.a.id}`} className="block rounded-2xl border border-line bg-white p-4 shadow-sm active:scale-[0.99]">
                <div className="flex items-center justify-between"><span className="font-extrabold">{r.orderNumber}</span><Badge tone={r.a.status === "assigned" ? "amber" : r.a.status === "accepted" ? "blue" : "green"}>{r.a.status === "assigned" ? "New" : r.a.status === "accepted" ? "Accepted" : "On the way"}</Badge></div>
                <p className="mt-2 text-sm text-muted">📍 {r.area} · {r.pin}</p>
                <p className="text-sm text-muted">🕒 {r.date} · {r.slot}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className={r.status === "ready_for_dispatch" || r.status === "out_for_delivery" ? "font-semibold text-emerald-700" : "text-amber-700"}>{r.status === "ready_for_dispatch" ? "Ready for pickup" : r.status === "out_for_delivery" ? "Out for delivery" : "Being prepared"}</span>
                  <span className="font-bold">{r.method === "cod" ? `Collect ${inr(r.total)}` : "Prepaid"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
