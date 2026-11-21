import type { Metadata } from "next";
import { Badge, PageHeader, Table } from "@/components/admin-ui";
import { getProducts } from "@/lib/catalog";
import { setStock } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryAdmin() {
  const products = (await getProducts({ includeInactive: true })).sort((a, b) => a.stockGrams / Math.max(1, a.lowStockGrams) - b.stockGrams / Math.max(1, b.lowStockGrams));
  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock is tracked in kilograms per product. Orders reserve stock instantly; cancellations return it." />
      <Table head={["Product", "Status", "Set stock (kg)", "Alert at (kg)", ""]}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3 font-semibold">{p.name}{!p.isActive && <span className="ml-2"><Badge>Inactive</Badge></span>}</td>
            <td className="px-4 py-3">{p.stockGrams < p.minGrams ? <Badge tone="red">Out of stock</Badge> : p.stockGrams <= p.lowStockGrams ? <Badge tone="amber">Low</Badge> : <Badge tone="green">OK</Badge>}</td>
            <td colSpan={3} className="px-4 py-2">
              <form action={setStock.bind(null, p.id)} className="flex items-center gap-2">
                <input name="stockKg" type="number" step="0.05" min="0" defaultValue={p.stockGrams / 1000} className="input w-28" aria-label={`Stock for ${p.name}`} />
                <span className="px-2 text-muted">alert</span>
                <input name="lowStockKg" type="number" step="0.05" min="0" defaultValue={p.lowStockGrams / 1000} className="input w-24" aria-label={`Low stock alert for ${p.name}`} />
                <button className="btn-dark py-2 text-xs">Update</button>
              </form>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
