"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { PaymentInit } from "@/lib/orders";
import { inr } from "@/lib/format";

export type PayResult = "success" | "failed" | "dismissed";

type RzpInstance = { open: () => void; on: (ev: string, cb: () => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RzpInstance;
  }
}

function loadScript(src: string) {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/** Opens Razorpay Checkout (test/live) or the clearly-labelled demo gateway when no keys are configured. */
export function usePayment(): { start: (init: PaymentInit) => Promise<PayResult>; modal: ReactNode } {
  const [demo, setDemo] = useState<{ init: Extract<PaymentInit, { mode: "demo" }>; resolve: (r: PayResult) => void } | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async (init: PaymentInit): Promise<PayResult> => {
    if (init.mode === "demo") return new Promise<PayResult>((resolve) => setDemo({ init, resolve }));
    const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!ok || !window.Razorpay) return "failed";
    return new Promise<PayResult>((resolve) => {
      const rzp = new window.Razorpay!({
        key: init.keyId,
        amount: Math.round(init.amount * 100),
        currency: init.currency,
        order_id: init.razorpayOrderId,
        name: "Chicken Mart",
        description: `Order ${init.orderNumber}`,
        prefill: init.prefill,
        theme: { color: "#e23744" },
        handler: async (resp: Record<string, string>) => {
          const r = await postJson("/api/payments/verify", resp);
          resolve(r.ok ? "success" : "failed");
        },
        modal: { ondismiss: () => resolve("dismissed") },
      });
      rzp.on("payment.failed", () => resolve("failed"));
      rzp.open();
    });
  }, []);

  async function finish(outcome: "success" | "failure") {
    if (!demo) return;
    setBusy(true);
    const r = await postJson("/api/payments/demo", { orderId: demo.init.orderId, outcome });
    setBusy(false);
    demo.resolve(r.ok && outcome === "success" ? "success" : "failed");
    setDemo(null);
  }

  const modal = demo ? (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Demo payment">
      <div className="anim-pop w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">Demo mode — no real money</span>
        <h3 className="mt-3 text-xl font-extrabold">Pay {inr(demo.init.amount)}</h3>
        <p className="mt-1 text-sm text-muted">Order {demo.init.orderNumber}. Razorpay keys are not configured, so this simulated gateway is used instead.</p>
        <div className="mt-5 grid gap-2">
          <button disabled={busy} onClick={() => finish("success")} className="btn-primary py-3">Simulate successful payment</button>
          <button disabled={busy} onClick={() => finish("failure")} className="btn-outline">Simulate failed payment</button>
          <button
            disabled={busy}
            onClick={() => {
              demo.resolve("dismissed");
              setDemo(null);
            }}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { start, modal };
}
