import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ConfirmButton, PageHeader, Table } from "@/components/admin-ui";
import { getProducts } from "@/lib/catalog";
import { inr, weightLabel } from "@/lib/format";
import { deleteProduct, setProductActive } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { q = "", show = "" } = await searchParams;
  const term = q.trim().toLowerCase();
  const all = await getProducts({ includeInactive: true });
  const list = all.filter((p) => (!term || `${p.name} ${p.categoryName}`.toLowerCase().includes(term)) && (show === "inactive" ? !p.isActive : show === "low" ? p.stockGrams <= p.lowStockGrams : true));
  return (
    <>
      <PageHeader title="Products" subtitle={`${list.length} of ${all.length} products`}>
        <Link href="/admin/products/new" className="btn-primary">+ Add product</Link>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search products" className="input max-w-xs" aria-label="Search" />
        <select name="show" defaultValue={show} className="input w-auto" aria-label="Filter"><option value="">All</option><option value="low">Low / out of stock</option><option value="inactive">Inactive</option></select>
        <button className="btn-dark">Filter</button>
      </form>
      <Table head={["Product", "Category", "Price / kg", "Stock", "Status", ""]} empty={list.length ? undefined : "No products found"}>
        {list.map((p) => (
          <tr key={p.id} className="hover:bg-surface/60">
            <td className="px-4 py-3"><div className="flex items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted">{p.variants.map(weightLabel).join(" · ") || "custom only"}</p></div></div></td>
            <td className="px-4 py-3 text-muted">{p.categoryName}</td>
            <td className="px-4 py-3"><b>{inr(p.pricePerKg)}</b>{p.mrpPerKg > p.pricePerKg && <span className="ml-1.5 text-xs text-muted line-through">{inr(p.mrpPerKg)}</span>}</td>
            <td className="px-4 py-3">{p.stockGrams < p.minGrams ? <Badge tone="red">Out of stock</Badge> : p.stockGrams <= p.lowStockGrams ? <Badge tone="amber">{weightLabel(p.stockGrams)} · low</Badge> : <span>{weightLabel(p.stockGrams)}</span>}</td>
            <td className="px-4 py-3">{p.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}{p.isFeatured && <span className="ml-1"><Badge tone="blue">Featured</Badge></span>}</td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                <Link href={`/admin/products/${p.id}`} className="btn-outline py-1.5 text-xs">Edit</Link>
                <form action={setProductActive.bind(null, p.id, !p.isActive)}><button className="btn-outline py-1.5 text-xs">{p.isActive ? "Deactivate" : "Activate"}</button></form>
                <form action={deleteProduct.bind(null, p.id)}><ConfirmButton message={`Delete ${p.name}? Products with past orders are only hidden.`}>Delete</ConfirmButton></form>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
