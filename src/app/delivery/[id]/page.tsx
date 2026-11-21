import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryAssignments, orderItems, orders } from "@/db/schema";
import { DeliveryActions } from "@/components/delivery-ui";
import { inr, weightLabel } from "@/lib/format";
import { requirePage } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function DeliveryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["delivery"], `/delivery/${id}`);
  if (!isUuid(id)) notFound();
  // Scoped by staff id: another rider's assignment simply 404s.
  const [row] = await db
    .select({ a: deliveryAssignments, o: orders })
    .from(deliveryAssignments)
    .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
    .where(and(eq(deliveryAssignments.id, id), eq(deliveryAssignments.staffId, user.id)))
    .limit(1);
  if (!row) notFound();
  const { a, o } = row;
  const live = ["assigned", "accepted", "out_for_delivery"].includes(a.status);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const ad = o.address;
  const addressLine = [ad.line1, ad.line2, ad.area, ad.landmark].filter(Boolean).join(", ");
  const dest = ad.latitude != null && ad.longitude != null ? `${ad.latitude},${ad.longitude}` : encodeURIComponent(`${addressLine}, ${ad.city} ${ad.pincode}`);
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;

  return (
    <>
      <Link href={live ? "/delivery" : "/delivery/history"} className="text-sm font-medium text-muted">← Back</Link>
      <div className="mt-2 flex items-center justify-between"><h1 className="text-xl font-extrabold">{o.orderNumber}</h1><span className="text-sm font-semibold capitalize text-muted">{a.status.replace(/_/g, " ")}</span></div>

      {live ? (
        <section className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <div><p className="text-xs font-bold uppercase text-muted">Customer</p><p className="text-lg font-bold">{ad.recipientName}</p></div>
          <div><p className="text-xs font-bold uppercase text-muted">Address</p><p className="leading-relaxed">{addressLine}</p><p className="text-muted">{ad.city}, {ad.state} {ad.pincode}</p></div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a href={`tel:+91${ad.phone}`} className="btn-outline py-3">📞 Call</a>
            <a href={nav} target="_blank" rel="noopener noreferrer" className="btn-dark py-3">🧭 Navigate</a>
          </div>
          <p className="text-center text-xs text-muted">+91 {ad.phone}</p>
          {o.notes && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Customer note: {o.notes}</p>}
        </section>
      ) : (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-muted ring-1 ring-line">This delivery is closed, so customer contact details are no longer shown.</p>
      )}

      <section className="mt-4 rounded-2xl border border-line bg-white p-4 text-sm shadow-sm">
        <p className="text-xs font-bold uppercase text-muted">Order · {o.deliveryDate} · {o.slotLabel}</p>
        <ul className="mt-2 divide-y divide-line">
          {items.map((i) => <li key={i.id} className="flex justify-between py-2"><span>{i.name} <span className="text-muted">· {weightLabel(i.grams)} × {i.quantity}</span></span></li>)}
        </ul>
        <div className={`mt-3 rounded-xl p-3 text-center font-bold ${o.paymentMethod === "cod" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
          {o.paymentMethod === "cod" ? `Collect ${inr(o.total)} in cash` : "Paid online — no cash to collect"}
        </div>
      </section>

      {a.failureReason && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Failed: {a.failureReason}</p>}
      {live && <div className="mt-5"><DeliveryActions id={a.id} status={a.status} orderStatus={o.status} cod={o.paymentMethod === "cod"} amount={o.total} /></div>}
    </>
  );
}
