import type { Metadata } from "next";
import { ActionForm, Badge, ImageUpload, PageHeader } from "@/components/admin-ui";
import { getCategories } from "@/lib/catalog";
import { saveCategory } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesAdmin() {
  const cats = await getCategories(false);
  return (
    <>
      <PageHeader title="Categories" subtitle="Shown as the round category cards on the storefront" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {cats.map((c) => (
            <details key={c.id} className="card shadow-sm">
              <summary className="flex cursor-pointer items-center gap-3 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.imageUrl && <img src={c.imageUrl} alt="" className="h-11 w-11 rounded-full object-cover" />}
                <span className="font-semibold">{c.name}</span>
                {!c.isActive && <Badge>Hidden</Badge>}
                <span className="ml-auto text-xs text-muted">Edit</span>
              </summary>
              <div className="border-t border-line p-4">
                <ActionForm action={saveCategory} className="space-y-3">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="grid gap-3 sm:grid-cols-3"><div className="sm:col-span-2"><label className="label">Name</label><input name="name" defaultValue={c.name} required className="input" /></div><div><label className="label">Sort order</label><input name="sortOrder" type="number" defaultValue={c.sortOrder} className="input" /></div></div>
                  <div><label className="label">Description</label><input name="description" defaultValue={c.description ?? ""} className="input" /></div>
                  <ImageUpload name="imageUrl" defaultValue={c.imageUrl ?? ""} />
                  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="isActive" defaultChecked={c.isActive} className="h-4 w-4 accent-[#14412b]" /> Visible on storefront</label>
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
        <section className="card h-fit p-5 shadow-sm">
          <h2 className="mb-3 font-extrabold">Add category</h2>
          <ActionForm action={saveCategory} className="space-y-3" resetOnSuccess>
            <div><label className="label">Name</label><input name="name" required className="input" /></div>
            <div><label className="label">Description</label><input name="description" className="input" /></div>
            <input type="hidden" name="sortOrder" value={cats.length} />
            <ImageUpload name="imageUrl" />
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#14412b]" /> Visible on storefront</label>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
