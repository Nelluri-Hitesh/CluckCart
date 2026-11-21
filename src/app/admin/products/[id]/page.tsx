import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ImageUpload, PageHeader } from "@/components/admin-ui";
import { getCategories, getProducts } from "@/lib/catalog";
import { isUuid } from "@/lib/validation";
import { saveProduct } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit product" };

export default async function ProductForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !isUuid(id)) notFound();
  const [cats, all] = await Promise.all([getCategories(false), getProducts({ includeInactive: true })]);
  const p = isNew ? null : all.find((x) => x.id === id);
  if (!isNew && !p) notFound();

  return (
    <>
      <PageHeader title={isNew ? "Add product" : `Edit ${p!.name}`}><Link href="/admin/products" className="btn-outline">← Products</Link></PageHeader>
      <ActionForm action={saveProduct} className="card max-w-3xl space-y-5 p-6 shadow-sm">
        <input type="hidden" name="id" value={p?.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Product name</label><input name="name" required defaultValue={p?.name} className="input" /></div>
          <div><label className="label">Category</label>
            <select name="categoryId" required defaultValue={p?.categoryId ?? ""} className="input"><option value="" disabled>Select…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
        </div>
        <div><label className="label">Description</label><textarea name="description" rows={3} defaultValue={p?.description} className="input" /></div>
        <div><label className="label">Piece info (shown on card)</label><input name="pieceInfo" defaultValue={p?.pieceInfo ?? ""} placeholder="Approx. 12–16 pieces / kg" className="input" /></div>
        <div><label className="label">Main image</label><ImageUpload name="imageUrl" defaultValue={p?.imageUrl} /></div>
        <div><label className="label">Extra image links (one per line, optional)</label><textarea name="extraImages" rows={2} defaultValue={p?.images.slice(1).join("\n")} className="input" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Selling price per kg (₹)</label><input name="pricePerKg" type="number" step="1" min="1" required defaultValue={p?.pricePerKg} className="input" /></div>
          <div><label className="label">MRP per kg (₹) — shown struck-through</label><input name="mrpPerKg" type="number" step="1" min="1" required defaultValue={p?.mrpPerKg} className="input" /></div>
        </div>
        <div><label className="label">Weight options in grams (comma separated)</label><input name="variants" defaultValue={p?.variants.join(", ") ?? "250, 500, 1000"} className="input" placeholder="250, 500, 1000" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Custom weight: minimum (g)</label><input name="minGrams" type="number" required defaultValue={p?.minGrams ?? 250} className="input" /></div>
          <div><label className="label">Step (g)</label><input name="stepGrams" type="number" required defaultValue={p?.stepGrams ?? 50} className="input" /></div>
          <div><label className="label">Maximum (g)</label><input name="maxGrams" type="number" required defaultValue={p?.maxGrams ?? 5000} className="input" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Stock available (kg)</label><input name="stockKg" type="number" step="0.05" min="0" required defaultValue={p ? p.stockGrams / 1000 : 20} className="input" /></div>
          <div><label className="label">Low-stock alert at (kg)</label><input name="lowStockKg" type="number" step="0.05" min="0" required defaultValue={p ? p.lowStockGrams / 1000 : 5} className="input" /></div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm font-medium">
          <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} className="h-4 w-4 accent-[#14412b]" /> Active (visible to customers)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={p?.isFeatured ?? false} className="h-4 w-4 accent-[#14412b]" /> Featured / popular</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="allowCustomWeight" defaultChecked={p?.allowCustomWeight ?? true} className="h-4 w-4 accent-[#14412b]" /> Allow custom weight</label>
        </div>
      </ActionForm>
    </>
  );
}
