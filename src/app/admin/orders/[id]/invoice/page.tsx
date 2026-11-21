import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { PrintButton } from "@/components/admin-ui";
import { fmtDate, inr, weightLabel } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice" };

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();
  const [items, s] = [await db.select().from(orderItems).where(eq(orderItems.orderId, id)), await getSettings()];
  const a = order.address;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <div className="card p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap justify-between gap-4 border-b border-line pb-5">
          <div>
            <h1 className="text-2xl font-extrabold">{s.shopName}</h1>
            <p className="text-sm text-muted">{s.address}</p>
            <p className="text-sm text-muted">{s.phone} · {s.email}</p>
            {s.gstin && <p className="text-sm text-muted">GSTIN: {s.gstin}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="text-lg font-extrabold">TAX INVOICE</p>
            <p>No: <b>{order.orderNumber}</b></p>
            <p>Date: {fmtDate(order.createdAt)}</p>
            <p>Payment: {order.paymentMethod === "cod" ? "Cash on delivery" : "Online"} ({order.paymentStatus})</p>
          </div>
        </div>
        <div className="py-5 text-sm">
          <p className="text-xs font-bold uppercase text-muted">Bill to / Deliver to</p>
          <p className="font-semibold">{a.recipientName} · +91 {a.phone}</p>
          <p className="text-muted">{[a.line1, a.line2, a.area, a.landmark].filter(Boolean).join(", ")}, {a.city}, {a.state} {a.pincode}</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-line text-xs uppercase text-muted"><tr><th className="py-2">Item</th><th>Weight</th><th>Qty</th><th>Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((i) => (
              <tr key={i.id}><td className="py-2.5">{i.name}</td><td>{weightLabel(i.grams)}</td><td>{i.quantity}</td><td>{inr(i.unitPrice)}</td><td className="text-right">{inr(i.lineTotal)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-5 w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between"><span>Discount {order.couponCode && `(${order.couponCode})`}</span><span>− {inr(order.discount)}</span></div>}
          <div className="flex justify-between"><span>Delivery</span><span>{inr(order.deliveryFee)}</span></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold"><span>Total</span><span>{inr(order.total)}</span></div>
          {order.tax > 0 && <p className="text-xs text-muted">Total includes GST of {inr(order.tax)}.</p>}
        </div>
        <p className="mt-8 text-center text-xs text-muted">Thank you for shopping with {s.shopName}. All prices are in INR and inclusive of applicable taxes.</p>
      </div>
    </div>
  );
}
