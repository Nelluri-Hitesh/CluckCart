import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/order-actions";
import { fmtDateTime, inr, weightLabel } from "@/lib/format";
import { getOrderDetail } from "@/lib/order-queries";
import { CUSTOMER_CANCELLABLE, STATUS_FLOW, STATUS_LABEL, statusTone } from "@/lib/order-status";
import { requirePage } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; payment?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requirePage(["customer"], `/orders/${id}`);
  const detail = isUuid(id) ? await getOrderDetail(id, user.id) : null;
  if (!detail) notFound();
  const { order, items, history, rider, refunds } = detail;

  const flow = STATUS_FLOW.filter((s) => order.paymentMethod === "online" || s !== "payment_confirmed");
  const reached = new Map(history.map((h) => [h.status, h.createdAt]));
  const currentIdx = flow.reduce((acc, s, i) => (reached.has(s) ? i : acc), 0);
  const cancelled = order.status === "cancelled";
  const unpaidOnline = order.paymentMethod === "online" && order.paymentStatus !== "paid" && !cancelled;
  const a = order.address;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {sp.placed && !cancelled && (
        <div className="anim-pop mb-5 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <p className="text-lg font-extrabold text-emerald-900">🎉 Order placed successfully!</p>
          <p className="mt-1 text-sm text-emerald-800">Your order number is <b>{order.orderNumber}</b>. We&apos;ll keep you updated at every step.</p>
        </div>
      )}
      {sp.payment === "failed" && unpaidOnline && (
        <div className="mb-5 rounded-2xl bg-red-50 p-5 ring-1 ring-red-200">
          <p className="font-bold text-red-800">Payment didn&apos;t go through</p>
          <p className="mt-1 text-sm text-red-700">Your items are reserved for a short time. Retry the payment below to confirm your order.</p>
        </div>
      )}
      {sp.payment === "dismissed" && unpaidOnline && (
        <div className="mb-5 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 text-sm font-medium text-amber-900">Payment is pending. Complete it below to confirm your order.</div>
      )}

      <Link href="/orders" className="text-sm font-medium text-muted hover:text-ink">← All orders</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{order.orderNumber}</h1>
          <p className="text-sm text-muted">Placed {fmtDateTime(order.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${statusTone[order.status]}`}>{STATUS_LABEL[order.status]}</span>
      </div>

      <div className="mt-4">
        <OrderActions orderId={order.id} canCancel={CUSTOMER_CANCELLABLE.includes(order.status)} canPay={unpaidOnline} />
      </div>

      {/* Tracking */}
      <section className="card mt-5 p-5">
        <h2 className="text-lg font-extrabold">Order tracking</h2>
        {cancelled ? (
          <div className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <b>Cancelled</b>{order.cancelReason ? ` — ${order.cancelReason}` : ""}
          </div>
        ) : (
          <ol className="mt-4">
            {flow.map((s, i) => {
              const done = reached.has(s) || i < currentIdx;
              const current = i === currentIdx;
              return (
                <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < flow.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${i < currentIdx ? "bg-emerald-500" : "bg-line"}`} />}
                  <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-emerald-500 text-white" : "bg-line text-muted"} ${current && order.status !== "delivered" ? "ring-4 ring-emerald-100" : ""}`}>
                    {done ? "✓" : i + 1}
                  </span>
                  <div className="-mt-0.5">
                    <p className={`text-sm font-semibold ${done ? "text-ink" : "text-muted"}`}>{STATUS_LABEL[s]}</p>
                    {reached.get(s) && <p className="text-xs text-muted">{fmtDateTime(reached.get(s)!)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {rider && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-orange-50 p-4 text-sm">
            <div><p className="font-bold text-orange-900">{rider.name} is delivering your order</p><p className="text-orange-800">Our delivery partner</p></div>
            <a href={`tel:+91${rider.phone}`} className="btn-dark">Call</a>
          </div>
        )}
        {order.refundStatus !== "none" && (
          <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
            <b>Refund {order.refundStatus === "completed" ? "completed" : "initiated"}</b>
            {refunds.length > 0 && <> — {inr(refunds.reduce((s, r) => s + r.amount, 0))}. {order.refundStatus === "initiated" ? "We are processing it now." : "It can take 5–7 working days to reflect in your account."}</>}
          </div>
        )}
      </section>

      {/* Items */}
      <section className="card mt-5 overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 text-lg font-extrabold">Items</h2>
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.imageUrl && <img src={i.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              <div className="flex-1"><p className="font-semibold">{i.name}</p><p className="text-xs text-muted">{weightLabel(i.grams)} × {i.quantity}</p></div>
              <span className="font-bold">{inr(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-line bg-surface/60 px-5 py-4 text-sm">
          <Row l="Item total" v={inr(order.subtotal)} />
          {order.discount > 0 && <Row l={`Coupon ${order.couponCode ?? ""}`} v={`− ${inr(order.discount)}`} />}
          <Row l="Delivery fee" v={order.deliveryFee === 0 ? "FREE" : inr(order.deliveryFee)} />
          <div className="flex justify-between border-t border-dashed border-line pt-2 text-base font-extrabold"><span>Total</span><span>{inr(order.total)}</span></div>
          <p className="text-xs text-muted">{order.paymentMethod === "cod" ? "Pay cash on delivery" : order.paymentStatus === "paid" ? "Paid online" : order.paymentStatus === "refunded" ? "Refunded" : `Online payment ${order.paymentStatus}`}</p>
        </div>
      </section>

      <section className="card mt-5 grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div>
          <h3 className="font-bold">Delivering to</h3>
          <p className="mt-1 text-muted">{a.recipientName} · {a.phone}</p>
          <p className="text-muted">{[a.line1, a.line2, a.area, a.landmark].filter(Boolean).join(", ")}, {a.city} {a.pincode}</p>
        </div>
        <div>
          <h3 className="font-bold">Delivery slot</h3>
          <p className="mt-1 text-muted">{order.deliveryDate} · {order.slotLabel}</p>
          {order.notes && <p className="mt-1 text-muted">Note: {order.notes}</p>}
        </div>
      </section>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between text-muted"><span>{l}</span><span className="text-ink">{v}</span></div>;
}
