"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { inr, weightLabel } from "@/lib/format";
import { BagIcon, MinusIcon, PlusIcon, TrashIcon, XIcon } from "./icons";
import { packPriceOf, useCart } from "./providers";

export function CartDrawer() {
  const cart = useCart();
  const pathname = usePathname();
  const { drawerOpen, setDrawerOpen, items, subtotal, mrpTotal, config } = cart;

  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (!drawerOpen) return null;
  const fee = config.freeDeliveryAbove > 0 && subtotal >= config.freeDeliveryAbove ? 0 : config.deliveryFee;
  const savings = mrpTotal - subtotal;
  const toFree = config.freeDeliveryAbove - subtotal;
  const belowMin = subtotal < config.minOrder;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Your cart">
      <div className="anim-fade absolute inset-0 bg-black/45" onClick={() => setDrawerOpen(false)} />
      <aside className="anim-drawer absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold">Your cart</h2>
            <p className="text-xs text-muted">{cart.count} {cart.count === 1 ? "item" : "items"}</p>
          </div>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close cart" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface">
            <XIcon />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-brand">
                <BagIcon size={36} />
              </div>
              <h3 className="mt-4 text-lg font-bold">Your cart is empty</h3>
              <p className="mt-1 text-sm text-muted">Add some fresh chicken to get started.</p>
              <Link href="/products" className="btn-primary mt-5">Browse chicken</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {toFree > 0 && config.freeDeliveryAbove > 0 ? (
                <div className="rounded-xl bg-white p-3 text-sm ring-1 ring-line">
                  Add <b className="text-brand">{inr(toFree)}</b> more for <b>free delivery</b>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, (subtotal / config.freeDeliveryAbove) * 100)}%` }} />
                  </div>
                </div>
              ) : config.freeDeliveryAbove > 0 ? (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">🎉 You&apos;ve unlocked free delivery</div>
              ) : null}

              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                {items.map((i) => {
                  const unit = packPriceOf(i.pricePerKg, i.grams);
                  return (
                    <li key={`${i.productId}:${i.grams}`} className="flex gap-3 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${i.slug}`} className="line-clamp-1 text-sm font-bold hover:text-brand">{i.name}</Link>
                        <p className="text-xs text-muted">{weightLabel(i.grams)} · {inr(unit)} each</p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-brand text-brand">
                            <button onClick={() => cart.setQuantity(i.productId, i.grams, i.quantity - 1)} aria-label="Decrease" className="grid h-8 w-8 place-items-center"><MinusIcon size={14} /></button>
                            <span className="w-6 text-center text-sm font-bold tabular-nums">{i.quantity}</span>
                            <button onClick={() => cart.setQuantity(i.productId, i.grams, i.quantity + 1)} aria-label="Increase" className="grid h-8 w-8 place-items-center"><PlusIcon size={14} /></button>
                          </div>
                          <span className="text-sm font-extrabold">{inr(unit * i.quantity)}</span>
                        </div>
                      </div>
                      <button onClick={() => cart.remove(i.productId, i.grams)} aria-label={`Remove ${i.name}`} className="self-start rounded-full p-1.5 text-muted hover:bg-surface hover:text-brand">
                        <TrashIcon size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="space-y-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
                <h3 className="font-bold">Bill details</h3>
                <Row label="Item total" value={inr(subtotal)} />
                {savings > 0 && <Row label="Product savings" value={`− ${inr(savings)} saved`} green />}
                <Row label="Delivery fee" value={fee === 0 ? "FREE" : inr(fee)} green={fee === 0} />
                <div className="flex justify-between border-t border-dashed border-line pt-2 text-base font-extrabold">
                  <span>To pay</span>
                  <span>{inr(subtotal + fee)}</span>
                </div>
                <p className="text-[11px] text-muted">Coupons can be applied at checkout. Final amount is confirmed by our server.</p>
              </div>
            </div>
            <footer className="border-t border-line bg-white p-4">
              {belowMin && <p className="mb-2 text-center text-xs font-medium text-amber-700">Minimum order is {inr(config.minOrder)} — add {inr(config.minOrder - subtotal)} more</p>}
              <Link href="/checkout" className={`btn-primary w-full py-3.5 text-base ${belowMin ? "pointer-events-none opacity-50" : ""}`}>
                Proceed to checkout · {inr(subtotal + fee)}
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className={green ? "font-semibold text-emerald-700" : "text-ink"}>{value}</span>
    </div>
  );
}

export function StickyCartBar() {
  const { count, subtotal, setDrawerOpen, hydrated } = useCart();
  const pathname = usePathname();
  if (!hydrated || count === 0 || pathname.startsWith("/checkout")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 md:hidden">
      <button onClick={() => setDrawerOpen(true)} className="anim-pop flex w-full items-center justify-between rounded-2xl bg-brand px-5 py-3.5 text-white shadow-[0_8px_30px_rgba(226,55,68,0.45)] active:scale-[0.99]">
        <span className="text-left">
          <span className="block text-xs font-medium text-white/80">{count} {count === 1 ? "item" : "items"}</span>
          <span className="block text-base font-extrabold">{inr(subtotal)}</span>
        </span>
        <span className="flex items-center gap-2 font-bold">View cart <BagIcon size={20} /></span>
      </button>
    </div>
  );
}
