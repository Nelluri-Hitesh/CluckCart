"use client";

import { useState } from "react";
import type { ProductDTO } from "@/lib/catalog";
import { discountPercent, inr, weightLabel } from "@/lib/format";
import { HeartIcon, MinusIcon, PlusIcon } from "./icons";
import { defaultGrams, toCartItem } from "./product-card";
import { packPriceOf, useCart, useToast, useWishlist } from "./providers";

export function ProductDetail({ product: p }: { product: ProductDTO }) {
  const cart = useCart();
  const toast = useToast();
  const wish = useWishlist();
  const [grams, setGrams] = useState(defaultGrams(p));
  const [custom, setCustom] = useState(false);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const pct = discountPercent(p.pricePerKg, p.mrpPerKg);
  const unit = packPriceOf(p.pricePerKg, grams);
  const liked = wish.ids.includes(p.id);
  const otherGrams = cart.gramsInCart(p.id);
  const lowStock = p.inStock && p.stockGrams <= p.lowStockGrams;

  function pick(g: number) {
    setCustom(false);
    setGrams(g);
  }
  function stepCustom(dir: number) {
    const base = custom ? grams : Math.max(p.minGrams, grams);
    setCustom(true);
    setGrams(Math.min(p.maxGrams, Math.max(p.minGrams, base + dir * p.stepGrams)));
  }
  function add() {
    if (!cart.add(toCartItem(p, grams), qty)) {
      toast(`Only ${weightLabel(Math.max(0, p.stockGrams - otherGrams))} more available`, "error");
      return;
    }
    toast(`${qty} × ${p.name} (${weightLabel(grams)}) added to cart`);
    cart.setDrawerOpen(true);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.images[img] ?? p.imageUrl} alt={p.name} className={`h-full w-full object-cover ${p.inStock ? "" : "grayscale"}`} />
          {pct > 0 && p.inStock && <span className="absolute left-0 top-5 rounded-r-xl bg-brand px-3.5 py-1.5 text-sm font-bold uppercase text-white shadow">{pct}% off</span>}
          <button onClick={() => wish.toggle(p.id)} aria-label="Toggle wishlist" className={`absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white shadow ${liked ? "text-brand" : "text-ink/60"}`}>
            <HeartIcon filled={liked} />
          </button>
        </div>
        {p.images.length > 1 && (
          <div className="mt-3 flex gap-2">
            {p.images.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="" onClick={() => setImg(i)} className={`h-16 w-16 cursor-pointer rounded-xl object-cover ring-2 ${i === img ? "ring-brand" : "ring-transparent"}`} />
            ))}
          </div>
        )}
      </div>

      <div>
        <span className="chip">{p.categoryName}</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{p.name}</h1>
        <p className="mt-2 leading-relaxed text-muted">{p.description}</p>
        {p.pieceInfo && <p className="mt-2 text-sm font-medium text-forest">{p.pieceInfo}</p>}

        <div className="mt-5 flex items-baseline gap-3">
          <span className="text-3xl font-extrabold">{inr(unit)}</span>
          {pct > 0 && <span className="text-lg text-muted line-through">{inr(packPriceOf(p.mrpPerKg, grams))}</span>}
          {pct > 0 && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-sm font-bold text-emerald-700">Save {inr(packPriceOf(p.mrpPerKg, grams) - unit)}</span>}
        </div>
        <p className="text-sm text-muted">{inr(p.pricePerKg)} per kg · inclusive of all taxes</p>

        <div className="mt-3 flex items-center gap-2 text-sm font-medium">
          <span className={`h-2.5 w-2.5 rounded-full ${p.inStock ? (lowStock ? "bg-amber-500" : "bg-emerald-500") : "bg-red-500"}`} />
          {p.inStock ? (lowStock ? `Hurry — only ${weightLabel(p.stockGrams)} left today` : "In stock — fresh today") : "Currently out of stock"}
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold">Choose weight</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.variants.map((g) => (
              <button key={g} onClick={() => pick(g)} aria-pressed={!custom && grams === g} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${!custom && grams === g ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink/30"}`}>
                {weightLabel(g)}
              </button>
            ))}
            {p.allowCustomWeight && (
              <button onClick={() => stepCustom(0)} aria-pressed={custom} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${custom ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink/30"}`}>
                Custom
              </button>
            )}
          </div>
          {custom && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface p-3">
              <button onClick={() => stepCustom(-1)} aria-label="Decrease weight" className="grid h-9 w-9 place-items-center rounded-lg bg-white shadow-sm"><MinusIcon size={16} /></button>
              <div className="min-w-24 text-center">
                <div className="text-lg font-extrabold">{weightLabel(grams)}</div>
                <div className="text-[11px] text-muted">in steps of {p.stepGrams} g · {weightLabel(p.minGrams)}–{weightLabel(p.maxGrams)}</div>
              </div>
              <button onClick={() => stepCustom(1)} aria-label="Increase weight" className="grid h-9 w-9 place-items-center rounded-lg bg-white shadow-sm"><PlusIcon size={16} /></button>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center rounded-xl border border-line">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className="grid h-12 w-12 place-items-center"><MinusIcon size={18} /></button>
            <span className="w-8 text-center font-bold tabular-nums">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Increase quantity" className="grid h-12 w-12 place-items-center"><PlusIcon size={18} /></button>
          </div>
          <button onClick={add} disabled={!p.inStock} className="btn-primary h-12 flex-1 text-base sm:flex-none sm:px-10">
            {p.inStock ? `Add to cart · ${inr(unit * qty)}` : "Out of stock"}
          </button>
        </div>
        <ul className="mt-8 space-y-2 rounded-2xl bg-cream p-4 text-sm text-ink/80">
          <li>✓ Cleaned, cut and packed fresh after you order</li>
          <li>✓ Delivered by our own team in your chosen slot</li>
          <li>✓ Pay online (UPI / cards) or cash on delivery</li>
        </ul>
      </div>
    </div>
  );
}
