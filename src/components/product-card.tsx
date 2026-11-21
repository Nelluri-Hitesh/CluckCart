"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductDTO } from "@/lib/catalog";
import { discountPercent, inr, weightLabel } from "@/lib/format";
import { HeartIcon, MinusIcon, PlusIcon } from "./icons";
import { packPriceOf, useCart, useToast, useWishlist } from "./providers";

export function defaultGrams(p: Pick<ProductDTO, "variants" | "minGrams">) {
  return p.variants.includes(500) ? 500 : (p.variants[0] ?? p.minGrams);
}

export function toCartItem(p: ProductDTO, grams: number) {
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    imageUrl: p.imageUrl,
    pricePerKg: p.pricePerKg,
    mrpPerKg: p.mrpPerKg,
    grams,
    stockGrams: p.stockGrams,
  };
}

export function ProductCard({ product: p, compact = false }: { product: ProductDTO; compact?: boolean }) {
  const cart = useCart();
  const toast = useToast();
  const wish = useWishlist();
  const [grams, setGrams] = useState(defaultGrams(p));
  const options = p.variants.length ? p.variants : [p.minGrams];
  const qty = cart.qtyOf(p.id, grams);
  const pct = discountPercent(p.pricePerKg, p.mrpPerKg);
  const liked = wish.ids.includes(p.id);
  const lowStock = p.inStock && p.stockGrams <= p.lowStockGrams;

  function add() {
    if (!cart.add(toCartItem(p, grams))) {
      toast(`Only ${weightLabel(p.stockGrams)} of ${p.name} available`, "error");
      return;
    }
    toast(`${p.name} · ${weightLabel(grams)} added`);
  }

  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${compact ? "w-[220px] shrink-0 sm:w-[250px]" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        <Link href={`/products/${p.slug}`} aria-label={p.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt={p.name} loading="lazy" className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${p.inStock ? "" : "grayscale"}`} />
        </Link>
        {pct > 0 && p.inStock && (
          <span className="absolute left-0 top-3 rounded-r-lg bg-brand px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
            {pct}% off
          </span>
        )}
        <button
          type="button"
          onClick={() => wish.toggle(p.id)}
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow transition hover:scale-110 ${liked ? "text-brand" : "text-ink/60"}`}
        >
          <HeartIcon size={17} filled={liked} />
        </button>
        {!p.inStock && (
          <div className="absolute inset-0 grid place-items-center bg-white/55">
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <Link href={`/products/${p.slug}`} className="line-clamp-1 text-[15px] font-bold leading-snug text-ink hover:text-brand">
          {p.name}
        </Link>
        <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted">{p.pieceInfo || p.description}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
          <span className={`inline-block h-2 w-2 rounded-full ${p.inStock ? (lowStock ? "bg-amber-500" : "bg-emerald-500") : "bg-red-500"}`} />
          <span className={p.inStock ? (lowStock ? "text-amber-700" : "text-emerald-700") : "text-red-600"}>
            {p.inStock ? (lowStock ? `Only ${weightLabel(p.stockGrams)} left` : "In stock") : "Currently unavailable"}
          </span>
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-extrabold">{inr(packPriceOf(p.pricePerKg, grams))}</span>
                {pct > 0 && <span className="text-xs text-muted line-through">{inr(packPriceOf(p.mrpPerKg, grams))}</span>}
              </div>
              <div className="text-[11px] text-muted">{inr(p.pricePerKg)} / kg</div>
            </div>
            <select
              value={grams}
              onChange={(e) => setGrams(Number(e.target.value))}
              aria-label="Select weight"
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-brand"
            >
              {options.map((g) => (
                <option key={g} value={g}>
                  {weightLabel(g)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            {!p.inStock ? (
              <button disabled className="btn w-full border border-line bg-surface text-muted">
                Unavailable
              </button>
            ) : qty === 0 ? (
              <button onClick={add} className="btn w-full border border-brand bg-brand-soft text-brand hover:bg-brand hover:text-white">
                ADD
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-brand px-1 py-1 text-white">
                <button onClick={() => cart.setQuantity(p.id, grams, qty - 1)} aria-label="Decrease quantity" className="grid h-8 w-10 place-items-center rounded-lg hover:bg-white/15">
                  <MinusIcon size={16} />
                </button>
                <span className="text-sm font-bold tabular-nums">{qty}</span>
                <button onClick={add} aria-label="Increase quantity" className="grid h-8 w-10 place-items-center rounded-lg hover:bg-white/15">
                  <PlusIcon size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="aspect-[4/3] animate-pulse bg-surface" />
      <div className="space-y-2 p-3.5">
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface" />
        <div className="h-3 w-full animate-pulse rounded bg-surface" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
        <div className="h-9 w-full animate-pulse rounded-xl bg-surface" />
      </div>
    </div>
  );
}
