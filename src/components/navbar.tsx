"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ProductDTO } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { BagIcon, CartIcon, ChevronDown, Logo, PinIcon, SearchIcon, UserIcon, XIcon } from "./icons";
import { useCart, useLocation, useToast } from "./providers";

type Cat = { id: string; name: string; slug: string; imageUrl: string | null };
type User = { name: string; role: string } | null;

export function Navbar({ user }: { user: User }) {
  const cart = useCart();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center gap-3 md:gap-6">
          <Link href="/" aria-label="Chicken Mart home" className="shrink-0">
            <Logo />
          </Link>
          <div className="hidden md:block">
            <LocationPicker />
          </div>
          <div className="hidden flex-1 md:block">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <div className="md:hidden">
              <LocationPicker compact />
            </div>
            <AccountMenu user={user} />
            <button
              onClick={() => cart.setDrawerOpen(true)}
              className="relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface"
              aria-label={`Open cart, ${cart.count} items`}
            >
              <CartIcon />
              <span className="hidden lg:inline">{cart.hydrated && cart.count > 0 ? inr(cart.subtotal) : "Cart"}</span>
              {cart.hydrated && cart.count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{cart.count}</span>
              )}
            </button>
          </div>
        </div>
        <div className="pb-3 md:hidden">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}

function AccountMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-surface">Log in</Link>
        <Link href="/register" className="hidden rounded-xl bg-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-ink/85 sm:block">Sign up</Link>
      </div>
    );
  }
  const first = user.name.split(" ")[0];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold hover:bg-surface" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-brand"><UserIcon size={16} /></span>
        <span className="hidden max-w-24 truncate sm:inline">{first}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div role="menu" className="anim-pop absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-xl">
          {user.role === "admin" && <MenuLink href="/admin" label="Admin dashboard" />}
          {user.role === "delivery" && <MenuLink href="/delivery" label="Delivery app" />}
          {user.role === "customer" && (
            <>
              <MenuLink href="/orders" label="My orders" />
              <MenuLink href="/account" label="Profile & addresses" />
            </>
          )}
          <button
            className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-surface"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setOpen(false);
              router.push("/");
              router.refresh();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} role="menuitem" className="block px-4 py-2.5 text-sm font-medium hover:bg-surface">
      {label}
    </Link>
  );
}

function LocationPicker({ compact = false }: { compact?: boolean }) {
  const { loc, setLoc } = useLocation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/service-check?pincode=${encodeURIComponent(pin)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.serviceable) {
        setLoc({ pincode: pin, area: data.area });
        toast(`Great! We deliver to ${data.area}`);
        setOpen(false);
      } else {
        setMsg(`Sorry, we don't deliver to ${pin} yet. We're expanding across Hyderabad soon.`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not check this PIN code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex max-w-[11rem] items-center gap-1.5 rounded-xl px-2 py-1.5 text-left hover:bg-surface md:max-w-[15rem]" aria-label="Choose delivery location">
        <PinIcon className="shrink-0 text-brand" size={compact ? 18 : 20} />
        {!compact && (
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px] font-medium text-muted">Deliver to</span>
            <span className="block truncate text-sm font-bold">{loc ? `${loc.area} · ${loc.pincode}` : "Select location"}</span>
          </span>
        )}
        {compact && <span className="max-w-[5.5rem] truncate text-xs font-bold">{loc ? loc.pincode : "Location"}</span>}
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div className="anim-pop absolute left-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-xl">
          <h3 className="font-bold">Where should we deliver?</h3>
          <p className="mt-0.5 text-xs text-muted">Enter your PIN code to check delivery in Hyderabad.</p>
          <form onSubmit={check} className="mt-3 flex gap-2">
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="e.g. 500081" className="input" aria-label="PIN code" autoFocus />
            <button className="btn-primary" disabled={pin.length !== 6 || busy}>{busy ? "…" : "Check"}</button>
          </form>
          {msg && <p className="mt-2 text-xs font-medium text-red-600">{msg}</p>}
          {loc && (
            <button onClick={() => { setLoc(null); setOpen(false); }} className="mt-3 text-xs font-semibold text-muted underline">
              Clear location
            </button>
          )}
        </div>
      )}
    </div>
  );
}

let catalogPromise: Promise<{ products: ProductDTO[]; categories: Cat[] }> | null = null;
const loadCatalog = () => (catalogPromise ??= fetch("/api/products").then((r) => r.json()).catch((e) => { catalogPromise = null; throw e; }));

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ products: ProductDTO[]; categories: Cat[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const term = q.trim().toLowerCase();
  const prods = data && term ? data.products.filter((p) => `${p.name} ${p.categoryName} ${p.description}`.toLowerCase().includes(term)).slice(0, 6) : [];
  const cats = data && term ? data.categories.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 3) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    router.push(term ? `/products?q=${encodeURIComponent(q.trim())}` : "/products");
  }

  return (
    <div className="relative w-full" ref={ref}>
      <form onSubmit={submit} role="search">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 shadow-sm transition focus-within:border-brand/60 focus-within:shadow-md">
          <SearchIcon size={18} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => { setOpen(true); loadCatalog().then(setData).catch(() => {}); }}
            placeholder="Search for curry cut, boneless, wings…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted"
            aria-label="Search products"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="text-muted hover:text-ink"><XIcon size={16} /></button>
          )}
        </div>
      </form>
      {open && term && (
        <div className="anim-pop absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          {!data ? (
            <p className="p-4 text-sm text-muted">Searching…</p>
          ) : prods.length + cats.length === 0 ? (
            <p className="p-4 text-sm text-muted">No chicken found for “{q}”. Try “curry” or “wings”.</p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {cats.map((c) => (
                <li key={c.id}>
                  <Link onClick={() => setOpen(false)} href={`/products?category=${c.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.imageUrl && <img src={c.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="ml-auto text-xs text-muted">Category</span>
                  </Link>
                </li>
              ))}
              {prods.map((p) => (
                <li key={p.id}>
                  <Link onClick={() => setOpen(false)} href={`/products/${p.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block text-xs text-muted">{p.categoryName}</span>
                    </span>
                    <span className="text-sm font-bold">{inr(p.pricePerKg)}<span className="text-xs font-normal text-muted">/kg</span></span>
                  </Link>
                </li>
              ))}
              <li className="border-t border-line">
                <button onClick={submit} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-brand hover:bg-surface">
                  <BagIcon size={16} /> See all results for “{q}”
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
