"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Quote } from "@/lib/orders";
import type { SlotOption } from "@/lib/slots";
import { inr, weightLabel } from "@/lib/format";
import { AddressForm, type Address } from "./address-form";
import { TagIcon } from "./icons";
import { usePayment } from "./payment";
import { useCart, useToast } from "./providers";

type Props = {
  user: { name: string; phone: string };
  addresses: Address[];
  slots: SlotOption[];
  codMax: number;
  paymentMode: "demo" | "test" | "live";
  shopOpen: boolean;
};

export function CheckoutForm({ user, addresses: initialAddresses, slots, codMax, paymentMode, shopOpen }: Props) {
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const pay = usePayment();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const firstSlot = slots.find((s) => s.remaining > 0)?.key ?? "";
  const [slotKey, setSlotKey] = useState(firstSlot);
  const [method, setMethod] = useState<"online" | "cod">("online");
  const [notes, setNotes] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useRef({ sig: "", key: "" });

  const address = addresses.find((a) => a.id === addressId);
  const payloadItems = useMemo(() => cart.items.map((i) => ({ productId: i.productId, grams: i.grams, quantity: i.quantity })), [cart.items]);
  const itemsSig = JSON.stringify(payloadItems);

  useEffect(() => {
    if (!cart.hydrated || payloadItems.length === 0) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payloadItems, couponCode: coupon, pincode: address?.pincode }),
          signal: ctl.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setQuote(null);
          setQuoteErr(data.error);
        } else {
          setQuote(data.quote);
          setQuoteErr(null);
        }
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSig, coupon, address?.pincode, cart.hydrated]);

  if (!cart.hydrated) return <div className="h-64 animate-pulse rounded-2xl bg-surface" />;
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-3xl">🛒</div>
        <h2 className="mt-4 text-xl font-bold">Your cart is empty</h2>
        <p className="mt-1 text-sm text-muted">Add some chicken to place an order.</p>
        <Link href="/products" className="btn-primary mt-5">Browse chicken</Link>
      </div>
    );
  }

  const grouped = ["Today", "Tomorrow"].map((d) => ({ day: d, slots: slots.filter((s) => s.dayLabel === d) })).filter((g) => g.slots.length);
  const codBlocked = quote ? quote.total > codMax : false;
  const blockers: string[] = [];
  if (!shopOpen) blockers.push("The shop is not accepting orders right now");
  if (!address) blockers.push("Add a delivery address");
  if (quote && quote.serviceable === false) blockers.push(`We don't deliver to ${address?.pincode} yet`);
  if (quote && quote.issues.length) blockers.push(quote.issues[0]);
  if (quote && quote.subtotal < quote.minOrder) blockers.push(`Minimum order is ${inr(quote.minOrder)}`);
  if (!slotKey) blockers.push("No delivery slot is available — please try later");
  if (method === "cod" && codBlocked) blockers.push(`Cash on delivery is limited to ${inr(codMax)}`);

  async function applyCoupon() {
    const c = couponInput.trim().toUpperCase();
    if (!c) return;
    setCoupon(c);
  }

  async function placeOrder() {
    if (placing || blockers.length || !address) return;
    setPlacing(true);
    setError(null);
    const sig = JSON.stringify([itemsSig, addressId, slotKey, method, coupon, notes]);
    if (idem.current.sig !== sig) idem.current = { sig, key: crypto.randomUUID() };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems, addressId, slotKey, paymentMethod: method, couponCode: coupon, notes, idempotencyKey: idem.current.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not place order");
      cart.clear();
      const id = data.order.id as string;
      if (data.payment) {
        const result = await pay.start(data.payment);
        router.push(`/orders/${id}?${result === "success" ? "placed=1" : `payment=${result}`}`);
      } else if (data.paymentError) {
        router.push(`/orders/${id}?payment=failed`);
      } else {
        router.push(`/orders/${id}?placed=1`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place order");
      toast(e instanceof Error ? e.message : "Could not place order", "error");
      setPlacing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {pay.modal}
      <div className="space-y-5">
        {/* Address */}
        <Section n={1} title="Delivery address">
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <label key={a.id} className={`cursor-pointer rounded-xl border p-3.5 text-sm transition ${addressId === a.id ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line hover:border-ink/30"}`}>
                <input type="radio" name="address" className="sr-only" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                <div className="flex items-center gap-2 font-bold">{a.label}{a.isDefault && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Default</span>}</div>
                <p className="mt-1 text-ink/80">{a.recipientName} · {a.phone}</p>
                <p className="text-muted">{[a.line1, a.line2, a.area, a.landmark].filter(Boolean).join(", ")}, {a.city} {a.pincode}</p>
              </label>
            ))}
          </div>
          {adding ? (
            <div className="mt-4 rounded-xl border border-line p-4">
              <h3 className="mb-3 font-bold">New address</h3>
              <AddressForm
                defaults={user}
                onSaved={(a) => {
                  setAddresses((prev) => [...prev, a]);
                  setAddressId(a.id);
                  setAdding(false);
                }}
                onCancel={addresses.length ? () => setAdding(false) : undefined}
              />
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-3 text-sm font-semibold text-brand hover:underline">+ Add a new address</button>
          )}
          {address && (
            <p className="mt-3 text-xs text-muted">Contact for this order: <b className="text-ink">{address.recipientName}</b>, +91 {address.phone}</p>
          )}
          {quote?.serviceable === false && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Sorry, we don&apos;t deliver to PIN {address?.pincode} yet. Choose another address.</p>
          )}
        </Section>

        {/* Slot */}
        <Section n={2} title="Delivery slot">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted">No delivery slots are open right now. Please check back soon.</p>
          ) : (
            grouped.map((g) => (
              <div key={g.day} className="mb-3 last:mb-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g.day}</p>
                <div className="flex flex-wrap gap-2">
                  {g.slots.map((s) => (
                    <button key={s.key} type="button" disabled={s.remaining < 1} onClick={() => setSlotKey(s.key)} aria-pressed={slotKey === s.key} className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${slotKey === s.key ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink/30"}`}>
                      {s.label}
                      {s.remaining < 1 && <span className="ml-1 text-[10px] font-normal">(full)</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </Section>

        {/* Payment */}
        <Section n={3} title="Payment method">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`cursor-pointer rounded-xl border p-4 text-sm transition ${method === "online" ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line hover:border-ink/30"}`}>
              <input type="radio" name="method" className="sr-only" checked={method === "online"} onChange={() => setMethod("online")} />
              <p className="font-bold">Pay online</p>
              <p className="text-muted">UPI, cards, netbanking, wallets via Razorpay</p>
              {paymentMode === "demo" && <p className="mt-1 text-xs font-semibold text-amber-700">Demo mode: simulated payment</p>}
              {paymentMode === "test" && <p className="mt-1 text-xs font-semibold text-amber-700">Razorpay TEST mode: no real money</p>}
            </label>
            <label className={`rounded-xl border p-4 text-sm transition ${codBlocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${method === "cod" ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line hover:border-ink/30"}`}>
              <input type="radio" name="method" className="sr-only" disabled={codBlocked} checked={method === "cod"} onChange={() => setMethod("cod")} />
              <p className="font-bold">Cash on delivery</p>
              <p className="text-muted">{codBlocked ? `Available up to ${inr(codMax)}` : "Pay in cash when your order arrives"}</p>
            </label>
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="notes">Delivery instructions (optional)</label>
            <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="e.g. Call on arrival, leave at security" className="input" />
          </div>
        </Section>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden shadow-sm">
          <h2 className="border-b border-line px-5 py-4 text-lg font-extrabold">Order summary</h2>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto">
            {cart.items.map((i) => (
              <li key={`${i.productId}:${i.grams}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.name}</p>
                  <p className="text-xs text-muted">{weightLabel(i.grams)} × {i.quantity}</p>
                </div>
                <span className="font-bold">{inr(Math.round((i.pricePerKg * i.grams) / 1000) * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3 border-t border-line p-5 text-sm">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <TagIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyCoupon()} placeholder="Coupon code" aria-label="Coupon code" className="input pl-9 uppercase" />
              </div>
              <button onClick={applyCoupon} className="btn-outline">Apply</button>
            </div>
            {quote?.couponError && <p className="text-xs font-medium text-red-600">{quote.couponError}</p>}
            {quote?.couponCode && (
              <p className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                {quote.couponCode} applied — you save {inr(quote.discount)}
                <button onClick={() => { setCoupon(""); setCouponInput(""); }} className="underline">Remove</button>
              </p>
            )}
            {quoteErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{quoteErr}</p>}
            {quote ? (
              <>
                <Line label="Item total" value={inr(quote.subtotal)} />
                {quote.mrpTotal > quote.subtotal && <Line label="Product savings" value={`− ${inr(quote.mrpTotal - quote.subtotal)}`} green />}
                {quote.discount > 0 && <Line label="Coupon discount" value={`− ${inr(quote.discount)}`} green />}
                <Line label="Delivery fee" value={quote.deliveryFee === 0 ? "FREE" : inr(quote.deliveryFee)} green={quote.deliveryFee === 0} />
                {quote.tax > 0 && <Line label="Includes GST" value={inr(quote.tax)} muted />}
                <div className="flex justify-between border-t border-dashed border-line pt-3 text-lg font-extrabold">
                  <span>To pay</span>
                  <span>{inr(quote.total)}</span>
                </div>
              </>
            ) : !quoteErr ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-surface" />)}</div>
            ) : null}

            {blockers.length > 0 && quote && <p className="text-xs font-medium text-amber-700">{blockers[0]}</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
            <button onClick={placeOrder} disabled={placing || !quote || blockers.length > 0} className="btn-primary w-full py-3.5 text-base">
              {placing ? "Placing order…" : method === "online" ? `Pay ${quote ? inr(quote.total) : ""} & place order` : "Place order (Cash on delivery)"}
            </button>
            <p className="text-center text-[11px] text-muted">Prices are re-checked on our server when you place the order.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-extrabold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Line({ label, value, green, muted }: { label: string; value: string; green?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-xs text-muted" : "text-muted"}`}>
      <span>{label}</span>
      <span className={green ? "font-semibold text-emerald-700" : "text-ink"}>{value}</span>
    </div>
  );
}
