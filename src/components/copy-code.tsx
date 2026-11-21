"use client";

import { useToast } from "./providers";

export function CopyCode({ code }: { code: string }) {
  const toast = useToast();
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(code).catch(() => {});
        toast(`Code ${code} copied — apply it at checkout`);
      }}
      className="rounded-lg border border-dashed border-brand bg-white px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-brand hover:bg-brand-soft"
      aria-label={`Copy coupon code ${code}`}
    >
      {code}
    </button>
  );
}
