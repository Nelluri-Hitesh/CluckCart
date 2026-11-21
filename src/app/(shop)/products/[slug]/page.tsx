import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ProductDetail } from "@/components/product-detail";
import { ScrollRow, SectionHeader } from "@/components/scroll-row";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getProducts()).find((x) => x.slug === slug);
  return { title: p?.name ?? "Product", description: p?.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getProducts();
  const product = all.find((p) => p.slug === slug);
  if (!product) notFound();
  const related = all.filter((p) => p.categoryId === product.categoryId && p.id !== product.id);
  const more = related.length >= 3 ? related : [...related, ...all.filter((p) => p.categoryId !== product.categoryId && p.id !== product.id && p.isFeatured)].slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link><ChevronRight size={14} />
        <Link href="/products" className="hover:text-ink">Chicken</Link><ChevronRight size={14} />
        <Link href={`/products?category=${product.categorySlug}`} className="hover:text-ink">{product.categoryName}</Link><ChevronRight size={14} />
        <span className="font-semibold text-ink">{product.name}</span>
      </nav>
      <ProductDetail product={product} />
      {more.length > 0 && (
        <section className="mt-14">
          <SectionHeader title="You might also like" />
          <ScrollRow>
            {more.map((p) => (
              <div key={p.id} className="snap-start"><ProductCard product={p} compact /></div>
            ))}
          </ScrollRow>
        </section>
      )}
    </div>
  );
}
