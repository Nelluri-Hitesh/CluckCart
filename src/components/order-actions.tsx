"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePayment } from "./payment";
import { useToast } from "./providers";

export function OrderActions({ orderId, canCancel, canPay }: { orderId: string; canCancel: boolean; canPay: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const pay = usePayment();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("Cancel this order? Any online payment will be refunded.")) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Cancelled by customer" }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(data.error || "Could not cancel", "error");
    toast("Order cancelled");
    router.refresh();
  }

  async function retry() {
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return toast(data.error || "Could not start payment", "error");
    }
    const result = await pay.start(data.payment);
    setBusy(false);
    if (result === "success") toast("Payment received");
    else if (result === "failed") toast("Payment failed. You can try again.", "error");
    router.replace(`/orders/${orderId}${result === "success" ? "?placed=1" : ""}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pay.modal}
      {canPay && <button onClick={retry} disabled={busy} className="btn-primary">Pay now</button>}
      {canCancel && <button onClick={cancel} disabled={busy} className="btn-danger">Cancel order</button>}
    </div>
  );
}
