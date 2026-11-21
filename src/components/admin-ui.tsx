"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/app/admin/actions";
import { Logo } from "./icons";

const NAV: [string, string, string][] = [
  ["/admin", "Dashboard", "▦"],
  ["/admin/orders", "Orders", "🧾"],
  ["/admin/products", "Products", "🍗"],
  ["/admin/categories", "Categories", "🗂"],
  ["/admin/inventory", "Inventory", "📦"],
  ["/admin/customers", "Customers", "👥"],
  ["/admin/delivery", "Delivery", "🛵"],
  ["/admin/coupons", "Coupons", "🏷"],
  ["/admin/payments", "Payments", "💳"],
  ["/admin/reports", "Reports", "📈"],
  ["/admin/settings", "Settings", "⚙"],
];

export function AdminNav({ userName }: { userName: string }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <>
      <aside className="no-print hidden w-60 shrink-0 flex-col bg-forest-dark text-white/80 lg:flex">
        <div className="px-5 py-5"><Logo light /><p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">Admin</p></div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(([href, label, icon]) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(href) ? "bg-white/12 text-white" : "hover:bg-white/8 hover:text-white"}`}>
              <span className="w-5 text-center">{icon}</span>{label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs">
          <p className="truncate font-semibold text-white">{userName}</p>
          <Link href="/" className="mt-1 block text-white/60 hover:text-white">View storefront ↗</Link>
          <LogoutButton />
        </div>
      </aside>
      <div className="no-print sticky top-0 z-30 border-b border-line bg-forest-dark lg:hidden">
        <div className="flex items-center justify-between px-4 py-3"><Logo light size={26} /><LogoutButton light /></div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active(href) ? "bg-white text-forest-dark" : "text-white/75"}`}>{label}</Link>
          ))}
        </nav>
      </div>
    </>
  );
}

function LogoutButton({ light }: { light?: boolean }) {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
      className={`mt-2 text-left text-xs font-semibold ${light ? "text-white/80" : "text-white/60 hover:text-white"}`}
    >
      Log out
    </button>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string | number; hint?: string; tone?: "default" | "warn" | "good" }) {
  return (
    <div className="card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-extrabold ${tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-700" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "red" | "amber" | "blue" }) {
  const t = { gray: "bg-gray-100 text-gray-700", green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", blue: "bg-sky-50 text-sky-700" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
      {empty && <p className="px-4 py-10 text-center text-sm text-muted">{empty}</p>}
    </div>
  );
}

/** Form wired to a server action that returns {error}/{ok}; shows the message inline. */
export function ActionForm({ action, children, className = "", resetOnSuccess = false }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; children: ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const lastOk = useRef<ActionState>(null);
  if (resetOnSuccess && state?.ok && lastOk.current !== state) {
    lastOk.current = state;
    queueMicrotask(() => ref.current?.reset());
  }
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn-dark" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state?.error && <p role="alert" className="text-sm font-medium text-red-600">{state.error}</p>}
        {state?.ok && !state.error && <p className="text-sm font-medium text-emerald-700">✓ {state.ok}</p>}
      </div>
    </form>
  );
}

export function ImageUpload({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error || "Upload failed");
    setUrl(data.url);
  }
  return (
    <div className="flex items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="Preview" className="h-24 w-24 rounded-xl border border-line object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-line text-xs text-muted">No image</div>}
      <div className="flex-1 space-y-2">
        <input type="hidden" name={name} value={url} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Image link, or upload a file →" className="input" aria-label="Image URL" />
        <label className="btn-outline cursor-pointer py-2 text-xs">
          {busy ? "Uploading…" : "Upload image (JPG / PNG / WebP)"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {err && <p className="text-xs font-medium text-red-600">{err}</p>}
      </div>
    </div>
  );
}

export function PrintButton() {
  return <button onClick={() => window.print()} className="btn-dark">Print invoice</button>;
}

export function ConfirmButton({ children, message, className = "btn-danger py-1.5 text-xs" }: { children: ReactNode; message: string; className?: string }) {
  return (
    <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
