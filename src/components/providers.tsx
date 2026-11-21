"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, XIcon } from "./icons";

/* ---------------- Cart ---------------- */

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string;
  pricePerKg: number;
  mrpPerKg: number;
  grams: number;
  quantity: number;
  stockGrams: number;
};

export type ShopConfig = { deliveryFee: number; freeDeliveryAbove: number; minOrder: number };

export const cartKey = (productId: string, grams: number) => `${productId}:${grams}`;
export const packPriceOf = (pricePerKg: number, grams: number) => Math.round((pricePerKg * grams) / 1000);

type CartCtx = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  subtotal: number;
  mrpTotal: number;
  config: ShopConfig;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  gramsInCart: (productId: string) => number;
  qtyOf: (productId: string, grams: number) => number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => boolean;
  setQuantity: (productId: string, grams: number, qty: number) => void;
  remove: (productId: string, grams: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartCtx | null>(null);
const STORAGE_KEY = "cm_cart_v1";
const MAX_QTY = 20;

/* ---------------- Toast ---------------- */

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastContext = createContext<{ toast: (text: string, tone?: "ok" | "error") => void } | null>(null);

/* ---------------- Wishlist ---------------- */

const WishContext = createContext<{ ids: string[]; toggle: (id: string) => void } | null>(null);

/* ---------------- Location ---------------- */

type Loc = { pincode: string; area: string } | null;
const LocContext = createContext<{ loc: Loc; setLoc: (l: Loc) => void } | null>(null);

export function Providers({ children, config }: { children: ReactNode; config: ShopConfig }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [loc, setLocState] = useState<Loc>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        itemsRef.current = parsed;
        setItems(parsed);
      }
      const w = localStorage.getItem("cm_wish");
      if (w) setWish(JSON.parse(w));
      const l = localStorage.getItem("cm_loc");
      if (l) setLocState(JSON.parse(l));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const toast = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const itemsRef = useRef<CartItem[]>([]);
  const commit = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const add = useCallback<CartCtx["add"]>(
    (item, qty = 1) => {
      const prev = itemsRef.current;
      const used = prev.filter((i) => i.productId === item.productId).reduce((a, i) => a + i.grams * i.quantity, 0);
      if (used + item.grams * qty > item.stockGrams) return false;
      const idx = prev.findIndex((i) => i.productId === item.productId && i.grams === item.grams);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...item, quantity: Math.min(MAX_QTY, next[idx].quantity + qty) };
        commit(next);
      } else {
        commit([...prev, { ...item, quantity: Math.min(MAX_QTY, qty) }]);
      }
      return true;
    },
    [commit],
  );

  const setQuantity = useCallback(
    (productId: string, grams: number, qty: number) => {
      const prev = itemsRef.current;
      commit(
        prev
          .map((i) => {
            if (i.productId !== productId || i.grams !== grams) return i;
            const others = prev.filter((o) => o.productId === productId && o.grams !== grams).reduce((a, o) => a + o.grams * o.quantity, 0);
            const maxByStock = Math.floor((i.stockGrams - others) / grams);
            return { ...i, quantity: Math.max(0, Math.min(qty, MAX_QTY, maxByStock)) };
          })
          .filter((i) => i.quantity > 0),
      );
    },
    [commit],
  );

  const remove = useCallback(
    (productId: string, grams: number) => {
      commit(itemsRef.current.filter((i) => !(i.productId === productId && i.grams === grams)));
    },
    [commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  const cart = useMemo<CartCtx>(() => {
    const count = items.reduce((a, i) => a + i.quantity, 0);
    const subtotal = items.reduce((a, i) => a + packPriceOf(i.pricePerKg, i.grams) * i.quantity, 0);
    const mrpTotal = items.reduce((a, i) => a + packPriceOf(i.mrpPerKg, i.grams) * i.quantity, 0);
    return {
      items,
      hydrated,
      count,
      subtotal,
      mrpTotal,
      config,
      drawerOpen,
      setDrawerOpen,
      gramsInCart: (pid) => items.filter((i) => i.productId === pid).reduce((a, i) => a + i.grams * i.quantity, 0),
      qtyOf: (pid, g) => items.find((i) => i.productId === pid && i.grams === g)?.quantity ?? 0,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [items, hydrated, config, drawerOpen, add, setQuantity, remove, clear]);

  const wishValue = useMemo(
    () => ({
      ids: wish,
      toggle: (id: string) =>
        setWish((prev) => {
          const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
          localStorage.setItem("cm_wish", JSON.stringify(next));
          return next;
        }),
    }),
    [wish],
  );

  const locValue = useMemo(
    () => ({
      loc,
      setLoc: (l: Loc) => {
        setLocState(l);
        if (l) localStorage.setItem("cm_loc", JSON.stringify(l));
        else localStorage.removeItem("cm_loc");
      },
    }),
    [loc],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      <CartContext.Provider value={cart}>
        <WishContext.Provider value={wishValue}>
          <LocContext.Provider value={locValue}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className={`anim-pop pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === "error" ? "bg-red-600" : "bg-ink"}`}
                >
                  {t.tone === "error" ? <XIcon size={16} /> : <CheckIcon size={16} />}
                  {t.text}
                </div>
              ))}
            </div>
          </LocContext.Provider>
        </WishContext.Provider>
      </CartContext.Provider>
    </ToastContext.Provider>
  );
}

function need<T>(v: T | null): T {
  if (!v) throw new Error("Providers missing");
  return v;
}
export const useCart = () => need(useContext(CartContext));
export const useToast = () => need(useContext(ToastContext)).toast;
export const useWishlist = () => need(useContext(WishContext));
export const useLocation = () => need(useContext(LocContext));
