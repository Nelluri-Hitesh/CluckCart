import Link from "next/link";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { CopyCode } from "@/components/copy-code";
import { LeafIcon, ShieldIcon, TruckIcon, ClockIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ScrollRow, SectionHeader } from "@/components/scroll-row";
import { getCategories, getProducts, type ProductDTO } from "@/lib/catalog";
import { discountPercent } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function Row({ title, subtitle, items, href }: { title: string; subtitle?: string; items: ProductDTO[]; href?: string }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto mt-10 max-w-7xl px-4">
      <SectionHeader title={title} subtitle={subtitle} href={href} />
      <ScrollRow>
        {items.map((p) => (
          <div key={p.id} className="snap-start">
            <ProductCard product={p} compact />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}

export default async function HomePage() {
  const now = new Date();
  const [products, categories, settings, offers] = await Promise.all([
    getProducts(),
    getCategories(),
    getSettings(),
    db
      .select()
      .from(coupons)
      .where(and(eq(coupons.isActive, true), or(isNull(coupons.validUntil), gt(coupons.validUntil, now))))
      .limit(3),
  ]);
  const popular = products.filter((p) => p.isFeatured && p.inStock);
  const deals = [...products].filter((p) => p.inStock && discountPercent(p.pricePerKg, p.mrpPerKg) > 0).sort((a, b) => discountPercent(b.pricePerKg, b.mrpPerKg) - discountPercent(a.pricePerKg, a.mrpPerKg)).slice(0, 10);
  const recommended = products.filter((p) => p.inStock && !p.isFeatured).slice(0, 10);
  const recent = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-5">
        <div className="relative overflow-hidden rounded-3xl bg-forest-dark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero.jpg" alt="Fresh chicken cuts" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-forest-dark via-forest-dark/85 to-transparent" />
          <div className="relative px-6 py-12 sm:px-10 md:py-20 lg:px-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <ClockIcon size={14} /> Same-day delivery across Hyderabad
            </span>
            <h1 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
              Fresh chicken, cut to order.<br />
              <span className="text-[#ff9aa2]">Delivered to your door.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm text-white/80 md:text-base">
              Curry cut, fry cut, boneless, wings and more — sourced daily and delivered by our own team.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/products" className="btn-primary px-6 py-3 text-base">Order now</Link>
              {settings.freeDeliveryAbove > 0 && (
                <span className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white">Free delivery above ₹{settings.freeDeliveryAbove}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto mt-10 max-w-7xl px-4">
        <SectionHeader title="What are you craving?" subtitle="Shop by cut" />
        <ScrollRow>
          {categories.map((c) => (
            <Link key={c.id} href={`/products?category=${c.slug}`} className="group w-28 shrink-0 snap-start text-center sm:w-36">
              <div className="aspect-square overflow-hidden rounded-full border border-line bg-surface shadow-sm transition group-hover:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.imageUrl && <img src={c.imageUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />}
              </div>
              <span className="mt-2.5 block text-sm font-semibold group-hover:text-brand">{c.name}</span>
            </Link>
          ))}
        </ScrollRow>
      </section>

      {/* Offers */}
      {offers.length > 0 && (
        <section className="mx-auto mt-10 max-w-7xl px-4">
          <SectionHeader title="Offers for you" subtitle="Tap a code to copy it, then apply at checkout" />
          <div className="grid gap-4 md:grid-cols-3">
            {offers.map((o, i) => (
              <div key={o.id} className={`flex items-center justify-between gap-4 rounded-2xl p-5 ${["bg-brand-soft", "bg-beige", "bg-emerald-50"][i % 3]}`}>
                <div>
                  <p className="text-lg font-extrabold">{o.type === "percent" ? `${o.value}% OFF` : `₹${o.value} OFF`}</p>
                  <p className="mt-1 text-sm text-ink/70">{o.description}</p>
                </div>
                <CopyCode code={o.code} />
              </div>
            ))}
          </div>
        </section>
      )}

      <Row title="Popular near you" subtitle="Hyderabad's most-ordered cuts" items={popular} href="/products" />
      <Row title="Deals & discounts" subtitle="Biggest savings today" items={deals} href="/products?offers=1" />
      <Row title="Recommended for you" items={recommended} href="/products" />
      <Row title="Recently added" items={recent} href="/products?sort=newest" />

      {/* Trust */}
      <section className="mx-auto mt-14 max-w-7xl px-4">
        <div className="grid gap-4 rounded-3xl bg-cream p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-8">
          {[
            [LeafIcon, "Fresh every morning", "Sourced daily — never frozen"],
            [ShieldIcon, "Hygienic cutting", "Cleaned and packed in our own shop"],
            [TruckIcon, "Our own delivery team", "Trained staff, no third parties"],
            [ClockIcon, "Pick your slot", "Choose a delivery window that suits you"],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof LeafIcon;
            return (
              <div key={t as string} className="flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-forest shadow-sm"><I size={22} /></span>
                <div>
                  <p className="font-bold">{t as string}</p>
                  <p className="text-sm text-muted">{d as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
