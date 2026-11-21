"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./icons";

export function DeliveryShell({ name, children }: { name: string; children: React.ReactNode }) {
  const path = usePathname();
  const tab = (href: string, label: string, icon: string) => (
    <Link href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${(href === "/delivery" ? path === "/delivery" || /^\/delivery\/[0-9a-f-]{36}$/.test(path) : path.startsWith(href)) ? "text-brand" : "text-muted"}`}>
      <span className="text-lg">{icon}</span>{label}
    </Link>
  );
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-surface pb-20">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-forest-dark px-4 py-3 text-white">
        <div><Logo light size={26} /><p className="mt-0.5 text-[11px] text-white/60">Delivery · {name}</p></div>
        <button className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>Log out</button>
      </header>
      <main className="p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg border-t border-line bg-white">
        {tab("/delivery", "Deliveries", "🛵")}
        {tab("/delivery/history", "History", "🧾")}
      </nav>
    </div>
  );
}

export function DeliveryActions({ id, status, orderStatus, cod, amount }: { id: string; status: string; orderStatus: string; cod: boolean; amount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState("Customer not reachable");
  const [other, setOther] = useState("");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/delivery/assignments/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error || "Something went wrong");
    setFailing(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{err}</p>}
      {status === "assigned" && <button disabled={busy} onClick={() => act("accept")} className="btn-primary w-full py-4 text-base">Accept delivery</button>}
      {status === "accepted" && (
        orderStatus === "ready_for_dispatch" ? (
          <button disabled={busy} onClick={() => act("start")} className="btn-primary w-full py-4 text-base">Picked up — start delivery</button>
        ) : (
          <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">The shop is still preparing this order. You can start once it is marked ready for dispatch.</p>
        )
      )}
      {status === "out_for_delivery" && !failing && (
        <>
          <button disabled={busy} onClick={() => confirm(cod ? `Confirm you collected ₹${amount} in cash and delivered the order?` : "Confirm the order was delivered?") && act("complete")} className="btn-dark w-full py-4 text-base">
            {cod ? `Delivered · cash collected ₹${amount}` : "Mark as delivered"}
          </button>
          <button disabled={busy} onClick={() => setFailing(true)} className="btn-danger w-full py-3">Could not deliver</button>
        </>
      )}
      {failing && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-white p-4">
          <p className="font-bold">Why could the delivery not be completed?</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
            {["Customer not reachable", "Customer not at address", "Address not found", "Customer refused order", "Other"].map((r) => <option key={r}>{r}</option>)}
          </select>
          {reason === "Other" && <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Describe the problem" className="input" />}
          <div className="flex gap-2">
            <button disabled={busy || (reason === "Other" && !other.trim())} onClick={() => act("fail", { reason: reason === "Other" ? other : reason })} className="btn-primary flex-1">Record failed attempt</button>
            <button onClick={() => setFailing(false)} className="btn-outline">Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
