"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "./icons";

export function ScrollRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * Math.max(300, (ref.current?.clientWidth ?? 600) * 0.8), behavior: "smooth" });
  return (
    <div className="group/row relative">
      <button onClick={() => scroll(-1)} aria-label="Scroll left" className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-white shadow-lg transition hover:scale-105 md:group-hover/row:grid">
        <ChevronLeft />
      </button>
      <div ref={ref} className={`no-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth py-1 ${className}`}>
        {children}
      </div>
      <button onClick={() => scroll(1)} aria-label="Scroll right" className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-white shadow-lg transition hover:scale-105 md:group-hover/row:grid">
        <ChevronRight />
      </button>
    </div>
  );
}

export function SectionHeader({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
          See all <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
