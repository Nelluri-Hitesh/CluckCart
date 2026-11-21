import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, refunds } from "@/db/schema";
import { Badge, ConfirmButton, PageHeader, Table } from "@/components/admin-ui";
import { fmtDateTime, inr } from "@/lib/format";
import { razorpayConfig } from "@/lib/razorpay";
import { processRefundAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsAdmin() {
  const [pays, refundRows] = await Promise.all([
    db.select({ p: payments, orderNumber: orders.orderNumber, orderId: orders.id }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).orderBy(desc(payments.createdAt)).limit(200),
    db.select({ r: refunds, orderNumber: orders.orderNumber, orderId: orders.id }).from(refunds).innerJoin(orders, eq(orders.id, refunds.orderId)).orderBy(desc(refunds.createdAt)).limit(100),
  ]);
  const mode = razorpayConfig().mode;
  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment attempt and refund.">
        <Badge tone={mode === "live" ? "green" : "amber"}>{mode === "live" ? "LIVE payments" : mode === "test" ? "Razorpay TEST mode" : "DEMO gateway (no Razorpay keys)"}</Badge>
      </PageHeader>
      <h2 className="mb-3 font-extrabold">Refunds</h2>
      <Table head={["Order", "Amount", "Reason", "Status", "Created", ""]} empty={refundRows.length ? undefined : "No refunds"}>
        {refundRows.map(({ r, orderNumber, orderId }) => (
          <tr key={r.id}>
            <td className="px-4 py-3 font-semibold"><Link className="text-brand hover:underline" href={`/admin/orders/${orderId}`}>{orderNumber}</Link></td>
            <td className="px-4 py-3 font-bold">{inr(r.amount)}</td><td className="px-4 py-3 text-muted">{r.reason}</td>
            <td className="px-4 py-3"><Badge tone={r.status === "processed" ? "green" : r.status === "failed" ? "red" : "amber"}>{r.status}</Badge></td>
            <td className="px-4 py-3 text-muted">{fmtDateTime(r.createdAt)}</td>
            <td className="px-4 py-3 text-right">{r.status === "initiated" && !r.providerRefundId && <form action={processRefundAction.bind(null, r.id)}><ConfirmButton message={`Refund ₹${r.amount}?`} className="btn-dark py-1.5 text-xs">Process</ConfirmButton></form>}</td>
          </tr>
        ))}
      </Table>
      <h2 className="mb-3 mt-8 font-extrabold">Payments</h2>
      <Table head={["Order", "Provider", "Amount", "Status", "Method", "Reference", "Created"]} empty={pays.length ? undefined : "No payments"}>
        {pays.map(({ p, orderNumber, orderId }) => (
          <tr key={p.id}>
            <td className="px-4 py-3 font-semibold"><Link className="text-brand hover:underline" href={`/admin/orders/${orderId}`}>{orderNumber}</Link></td>
            <td className="px-4 py-3">{p.provider}</td><td className="px-4 py-3 font-bold">{inr(p.amount)}</td>
            <td className="px-4 py-3"><Badge tone={p.status === "captured" ? "green" : p.status === "failed" ? "red" : "gray"}>{p.status}</Badge></td>
            <td className="px-4 py-3 text-muted">{p.method ?? "—"}</td>
            <td className="px-4 py-3 font-mono text-xs text-muted">{p.providerPaymentId ?? p.providerOrderId ?? "—"}</td>
            <td className="px-4 py-3 text-muted">{fmtDateTime(p.createdAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
