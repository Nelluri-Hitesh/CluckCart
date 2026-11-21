import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveryAssignments, orders } from "@/db/schema";
import { Badge } from "@/components/admin-ui";
import { fmtDateTime, inr } from "@/lib/format";
import { requirePage } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

export default async function DeliveryHistory() {
  const user = await requirePage(["delivery"], "/delivery/history");
  const rows = await db
    .select({ a: deliveryAssignments, orderNumber: orders.orderNumber, total: orders.total, pin: sql<string>`${orders.address}->>'pincode'` })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
    .where(and(eq(deliveryAssignments.staffId, user.id), inArray(deliveryAssignments.status, ["delivered", "failed", "reassigned", "cancelled"])))
    .orderBy(desc(deliveryAssignments.completedAt))
    .limit(100);
  const delivered = rows.filter((r) => r.a.status === "delivered").length;
  return (
    <>
      <h1 className="text-xl font-extrabold">Delivery history</h1>
      <p className="mb-4 text-sm text-muted">{delivered} delivered · {rows.filter((r) => r.a.status === "failed").length} failed attempts</p>
      {rows.length === 0 ? <p className="mt-16 text-center text-sm text-muted">Completed deliveries will show up here.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.a.id}>
              <Link href={`/delivery/${r.a.id}`} className="block rounded-2xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between"><span className="font-bold">{r.orderNumber}</span><Badge tone={r.a.status === "delivered" ? "green" : r.a.status === "failed" ? "red" : "gray"}>{r.a.status}</Badge></div>
                <p className="mt-1 text-xs text-muted">PIN {r.pin} · {inr(r.total)} · {r.a.completedAt ? fmtDateTime(r.a.completedAt) : ""}</p>
                {r.a.failureReason && <p className="mt-1 text-xs text-red-600">{r.a.failureReason}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
