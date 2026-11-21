"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProductDTO } from "@/lib/catalog";
import { discountPercent } from "@/lib/format";
import { ProductCard } from "./product-card";
import { ChevronRight, SearchIcon, XIcon } from "./icons";

type Cat = { id: string; name: string; slug: string; imageUrl: string | null };
type Sort = "relevance" | "price-asc" | "price-desc" | "discount" | "newest" | "name";

export function ProductExplorer({
  products,
  categories,
  initial,
}: {
  products: ProductDTO[];
  categories: Cat[];
  initial: { category: string; q: string; sort: Sort; offers: boolean };
}) {
  const [category, setCategory] = useState(initial.category);
  const [q, setQ] = useState(initial.q);
  const [sort, setSort] = useState<Sort>(initial.sort);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(initial.offers);
  const [maxPrice, setMaxPrice] = useState(0);

  // Keep the URL shareable without reloading the page.
  useEffect(() => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (q.trim()) p.set("q", q.trim());
    if (sort !== "relevance") p.set("sort", sort);
    if (offersOnly) p.set("offers", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `/products?${qs}` : "/products");
  }, [category, q, sort, offersOnly]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = products.filter((p) => {
      if (category && p.categorySlug !== category) return false;
      if (term && !`${p.name} ${p.categoryName} ${p.description}`.toLowerCase().includes(term)) return false;
      if (inStockOnly && !p.inStock) return false;
      if (offersOnly && discountPercent(p.pricePerKg, p.mrpPerKg) === 0) return false;
      if (maxPrice && p.pricePerKg > maxPrice) return false;
      return true;
    });
    const d = (p: ProductDTO) => discountPercent(p.pricePerKg, p.mrpPerKg);
    r = [...r].sort((a, b) => {
      switch (sort) {
        case "price-asc": return a.pricePerKg - b.pricePerKg;
        case "price-desc": return b.pricePerKg - a.pricePerKg;
        case "discount": return d(b) - d(a);
        case "newest": return b.createdAt.localeCompare(a.createdAt);
        case "name": return a.name.localeCompare(b.name);
        default: return Number(b.inStock) - Number(a.inStock) || Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name);
      }
    });
    return r;
  }, [products, category, q, sort, inStockOnly, offersOnly, maxPrice]);

  const activeCat = categories.find((c) => c.slug === category);
  const filtersOn = inStockOnly || offersOnly || maxPrice > 0 || !!q || !!category;
  const reset = () => { setCategory(""); setQ(""); setInStockOnly(false); setOffersOnly(false); setMaxPrice(0); setSort("relevance"); };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={14} />
        <button onClick={() => setCategory("")} className={category ? "hover:text-ink" : "font-semibold text-ink"}>Chicken</button>
        {activeCat && (<><ChevronRight size={14} /><span className="font-semibold text-ink">{activeCat.name}</span></>)}
      </nav>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">{activeCat ? activeCat.name : "Fresh chicken"} <span className="text-base font-medium text-muted">({list.length})</span></h1>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3.5 shadow-sm focus-within:border-brand/60">
        <SearchIcon size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in chicken…" aria-label="Search products" className="h-11 w-full bg-transparent text-sm outline-none" />
        {q && <button onClick={() => setQ("")} aria-label="Clear" className="text-muted"><XIcon size={16} /></button>}
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button onClick={() => setCategory("")} className={`chip ${!category ? "chip-active" : ""}`}>All</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.slug === category ? "" : c.slug)} className={`chip ${category === c.slug ? "chip-active" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.imageUrl && <img src={c.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />}
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-line py-3">
        <button onClick={() => setInStockOnly((v) => !v)} className={`chip ${inStockOnly ? "chip-active" : ""}`} aria-pressed={inStockOnly}>In stock</button>
        <button onClick={() => setOffersOnly((v) => !v)} className={`chip ${offersOnly ? "chip-active" : ""}`} aria-pressed={offersOnly}>Offers</button>
        <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} aria-label="Price filter" className="chip cursor-pointer outline-none">
          <option value={0}>Any price</option>
          <option value={250}>Under ₹250/kg</option>
          <option value={300}>Under ₹300/kg</option>
          <option value={400}>Under ₹400/kg</option>
        </select>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label htmlFor="sort" className="hidden text-muted sm:block">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="chip cursor-pointer outline-none">
            <option value="relevance">Relevance</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="discount">Discount</option>
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-surface text-3xl">🍗</div>
          <h2 className="mt-4 text-lg font-bold">No chicken matches your filters</h2>
          <p className="mt-1 text-sm text-muted">Try a different search or clear the filters.</p>
          <button onClick={reset} className="btn-primary mt-5">Clear filters</button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
      {filtersOn && list.length > 0 && (
        <div className="mt-6 text-center"><button onClick={reset} className="text-sm font-semibold text-brand hover:underline">Clear all filters</button></div>
      )}
    </div>
  );
}
