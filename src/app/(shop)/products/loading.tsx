import { ProductCardSkeleton } from "@/components/product-card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="h-4 w-40 animate-pulse rounded bg-surface" />
      <div className="mt-3 h-8 w-64 animate-pulse rounded bg-surface" />
      <div className="mt-5 h-11 animate-pulse rounded-xl bg-surface" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
