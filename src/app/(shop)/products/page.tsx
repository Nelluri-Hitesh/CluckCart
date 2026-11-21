import type { Metadata } from "next";
import { ProductExplorer } from "@/components/product-explorer";
import { getCategories, getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shop fresh chicken" };

const SORTS = ["relevance", "price-asc", "price-desc", "discount", "newest", "name"] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const sort = one(sp.sort);
  return (
    <ProductExplorer
      products={products}
      categories={categories}
      initial={{
        category: one(sp.category),
        q: one(sp.q),
        sort: (SORTS as readonly string[]).includes(sort) ? (sort as (typeof SORTS)[number]) : "relevance",
        offers: one(sp.offers) === "1",
      }}
    />
  );
}
