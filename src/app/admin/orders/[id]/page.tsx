import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryAssignments, deliveryStatusHistory, orderItems, orderStatusHistory, orders, payments, profiles, refunds } from "@/db/schema";
import { Badge, ConfirmButton, PageHeader } from "@/components/admin-ui";
import { fmtDateTime, inr, weightLabel } from "@/lib/format";
import { STATUS_LABEL, TRANSITIONS } from "@/lib/order-status";
import { isUuid } from "@/lib/validation";
import { assignOrder, cancelOrderAdmin, processRefundAction, refundOrder, setOrderStatus } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order" };

export default async function OrderAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();
  const [items, history, pays, refundRows, assignments, staff, dHistory] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt)),
    db.select().from(refunds).where(eq(refunds.orderId, id)).orderBy(desc(refunds.createdAt)),
    db.select({ a: deliveryAssignments, name: profiles.name, phone: profiles.phone }).from(deliveryAssignments).innerJoin(profiles, eq(profiles.id, deliveryAssignments.staffId)).where(eq(deliveryAssignments.orderId, id)).orderBy(desc(deliveryAssignments.assignedAt)),
    db.select({ id: profiles.id, name: profiles.name }).from(profiles).where(and(eq(profiles.role, "delivery"), eq(profiles.isActive, true))),
    db.select().from(deliveryStatusHistory).where(eq(deliveryStatusHistory.orderId, id)).orderBy(asc(deliveryStatusHistory.createdAt)),
  ]);
  const activeStaff = staff;
  const next = (TRANSITIONS[order.status] ?? []).filter((s) => s !== "cancelled");
  const blockedPay = order.paymentMethod === "online" && order.paymentStatus !== "paid";
  const terminal = order.status === "delivered" || order.status === "cancelled";
  const currentAssign = assignments.find((x) => ["assigned", "accepted", "out_for_delivery"].includes(x.a.status));
  const refundedSum = refundRows.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amount, 0);
  const a = order.address;

  return (
    <>
      <PageHeader title={order.orderNumber} subtitle={`Placed ${fmtDateTime(order.createdAt)}`}>
        <Link href="/admin/orders" className="btn-outline">← Orders</Link>
        <Link href={`/admin/orders/${id}/invoice`} className="btn-dark">Invoice</Link>
      </PageHeader>
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge tone={order.status === "delivered" ? "green" : order.status === "cancelled" ? "red" : "amber"}>{STATUS_LABEL[order.status]}</Badge>
        <Badge tone={order.paymentStatus === "paid" ? "green" : "gray"}>{order.paymentMethod === "cod" ? "Cash on delivery" : "Online"} · {order.paymentStatus}</Badge>
        {order.refundStatus !== "none" && <Badge tone="blue">Refund {order.refundStatus}</Badge>}
        {order.couponCode && <Badge>Coupon {order.couponCode}</Badge>}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="card overflow-hidden shadow-sm">
            <h2 className="border-b border-line px-5 py-3.5 font-extrabold">Items</h2>
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.imageUrl && <img src={i.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />}
                  <div className="flex-1"><p className="font-semibold">{i.name}</p><p className="text-xs text-muted">{weightLabel(i.grams)} × {i.quantity} · {inr(i.unitPrice)} each</p></div>
                  <b>{inr(i.lineTotal)}</b>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-line bg-surface/60 px-5 py-4 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-muted"><span>Discount</span><span>− {inr(order.discount)}</span></div>}
              <div className="flex justify-between text-muted"><span>Delivery</span><span>{inr(order.deliveryFee)}</span></div>
              {order.tax > 0 && <div className="flex justify-between text-xs text-muted"><span>Includes GST</span><span>{inr(order.tax)}</span></div>}
              <div className="flex justify-between border-t border-dashed border-line pt-2 text-base font-extrabold"><span>Total</span><span>{inr(order.total)}</span></div>
            </div>
          </section>

          <section className="card p-5 shadow-sm">
            <h2 className="mb-3 font-extrabold">Timeline</h2>
            <ol className="space-y-2 text-sm">
              {[...history.map((h) => ({ t: h.createdAt, text: `${STATUS_LABEL[h.status] ?? h.status}${h.note ? ` — ${h.note}` : ""}` })), ...dHistory.map((h) => ({ t: h.createdAt, text: `Delivery: ${h.status}${h.note ? ` — ${h.note}` : ""}` }))]
                .sort((x, y) => +x.t - +y.t)
                .map((e, i) => (<li key={i} className="flex gap-3"><span className="w-28 shrink-0 text-xs text-muted">{fmtDateTime(e.t)}</span><span>{e.text}</span></li>))}
            </ol>
          </section>

          <section className="card p-5 shadow-sm">
            <h2 className="mb-3 font-extrabold">Payments & refunds</h2>
            <ul className="space-y-1 text-sm">
              {pays.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.status === "captured" ? "green" : p.status === "failed" ? "red" : "gray"}>{p.status}</Badge>
                  <span>{p.provider} · {inr(p.amount)}</span>
                  {p.providerPaymentId && <code className="text-xs text-muted">{p.providerPaymentId}</code>}
                  {p.signatureVerified && <span className="text-xs text-emerald-700">signature verified</span>}
                </li>
              ))}
            </ul>
            {refundRows.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                {refundRows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.status === "processed" ? "green" : r.status === "failed" ? "red" : "amber"}>Refund {r.status}</Badge>
                    <span>{inr(r.amount)}</span><span className="text-muted">{r.reason}</span>
                    {r.status === "initiated" && !r.providerRefundId && (
                      <form action={processRefundAction.bind(null, r.id)}><ConfirmButton message={`Send a refund of ₹${r.amount} to the customer?`} className="btn-dark py-1.5 text-xs">Process refund</ConfirmButton></form>
                    )}
                    {r.status === "initiated" && r.providerRefundId && <span className="text-xs text-muted">awaiting bank confirmation</span>}
                  </li>
                ))}
              </ul>
            )}
            {order.paymentMethod === "online" && order.paymentStatus === "paid" && order.total - refundedSum > 0 && (
              <form action={refundOrder.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
                <div><label className="label">Refund amount (₹)</label><input name="amount" type="number" min={1} max={order.total - refundedSum} defaultValue={order.total - refundedSum} className="input w-36" /></div>
                <div className="min-w-48 flex-1"><label className="label">Reason</label><input name="reason" required className="input" placeholder="e.g. Quality issue" /></div>
                <ConfirmButton message="Issue this refund now?" className="btn-dark">Refund</ConfirmButton>
              </form>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-extrabold">Customer</h2>
            <p className="font-semibold">{order.customerName}</p>
            <a href={`tel:+91${order.customerPhone}`} className="text-brand">+91 {order.customerPhone}</a>
            <p className="mt-2 text-muted">{[a.line1, a.line2, a.area, a.landmark].filter(Boolean).join(", ")}, {a.city} {a.pincode}</p>
            <p className="mt-2 text-xs text-muted">Slot: {order.deliveryDate} · {order.slotLabel}</p>
            {order.notes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Note: {order.notes}</p>}
            <Link href={`/admin/customers/${order.userId}`} className="mt-3 inline-block text-xs font-semibold text-brand">View customer →</Link>
          </section>

          {!terminal && (
            <section className="card p-5 shadow-sm">
              <h2 className="mb-3 font-extrabold">Update status</h2>
              {blockedPay ? <p className="text-sm text-amber-700">Waiting for online payment. The order cannot move forward until it is paid.</p> : next.length === 0 ? <p className="text-sm text-muted">No further steps.</p> : (
                <form action={setOrderStatus.bind(null, id)} className="space-y-2">
                  <select name="status" className="input">{next.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
                  <input name="note" className="input" placeholder="Note (optional)" />
                  <button className="btn-dark w-full">Update</button>
                </form>
              )}
            </section>
          )}

          {!terminal && !blockedPay && (
            <section className="card p-5 shadow-sm">
              <h2 className="mb-3 font-extrabold">Delivery partner</h2>
              {currentAssign ? (
                <p className="mb-3 text-sm">Assigned to <b>{currentAssign.name}</b> <Badge tone="blue">{currentAssign.a.status.replace(/_/g, " ")}</Badge></p>
              ) : <p className="mb-3 text-sm text-muted">Not assigned yet.</p>}
              {["accepted", "preparing", "ready_for_dispatch"].includes(order.status) ? (
                <form action={assignOrder.bind(null, id)} className="space-y-2">
                  <select name="staffId" required className="input" defaultValue="">
                    <option value="" disabled>Choose delivery partner…</option>
                    {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button className="btn-dark w-full">{currentAssign ? "Reassign" : "Assign"}</button>
                </form>
              ) : <p className="text-xs text-muted">Accept the order first to assign delivery.</p>}
            </section>
          )}
          {assignments.some((x) => x.a.status === "failed") && (
            <section className="card border-red-200 p-5 text-sm shadow-sm">
              <h2 className="mb-2 font-extrabold text-red-700">Failed delivery attempts</h2>
              {assignments.filter((x) => x.a.status === "failed").map((x) => <p key={x.a.id} className="text-muted">{x.name}: {x.a.failureReason}</p>)}
            </section>
          )}

          {!terminal && (
            <section className="card p-5 shadow-sm">
              <h2 className="mb-3 font-extrabold">Cancel order</h2>
              <form action={cancelOrderAdmin.bind(null, id)} className="space-y-2">
                <input name="reason" required className="input" placeholder="Reason (shown to customer)" />
                <ConfirmButton message="Cancel this order? Stock will be restored and paid online orders queued for refund." className="btn-danger w-full">Cancel order</ConfirmButton>
              </form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
