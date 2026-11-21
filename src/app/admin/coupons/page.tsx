import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { couponRedemptions, coupons } from "@/db/schema";
import { ActionForm, Badge, PageHeader, Table } from "@/components/admin-ui";
import { fmtDate, inr } from "@/lib/format";
import { saveCoupon, setCouponActive } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsAdmin() {
  const rows = await db
    .select({ c: coupons, used: sql<number>`(select count(*) from ${couponRedemptions} r where r.coupon_id = ${coupons.id})::int` })
    .from(coupons)
    .orderBy(desc(coupons.createdAt));
  return (
    <>
      <PageHeader title="Coupons & offers" subtitle="Active coupons are also shown on the storefront homepage." />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Table head={["Code", "Offer", "Rules", "Used", "Expires", "Status", ""]} empty={rows.length ? undefined : "No coupons yet"}>
            {rows.map(({ c, used }) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                <td className="px-4 py-3">{c.type === "percent" ? `${c.value}%` : inr(c.value)} off<div className="text-xs text-muted">{c.description}</div></td>
                <td className="px-4 py-3 text-xs text-muted">Min {inr(c.minOrder)}{c.maxDiscount ? ` · max ${inr(c.maxDiscount)}` : ""} · {c.perUserLimit}/user</td>
                <td className="px-4 py-3">{used}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td className="px-4 py-3 text-muted">{c.validUntil ? fmtDate(c.validUntil) : "Never"}</td>
                <td className="px-4 py-3">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>}</td>
                <td className="px-4 py-3 text-right"><form action={setCouponActive.bind(null, c.id, !c.isActive)}><button className="btn-outline py-1.5 text-xs">{c.isActive ? "Disable" : "Enable"}</button></form></td>
              </tr>
            ))}
          </Table>
        </div>
        <section className="card h-fit p-5 shadow-sm">
          <h2 className="mb-3 font-extrabold">New coupon</h2>
          <ActionForm action={saveCoupon} className="space-y-3" resetOnSuccess>
            <div><label className="label">Code</label><input name="code" required className="input uppercase" placeholder="WELCOME100" /></div>
            <div><label className="label">Description</label><input name="description" className="input" placeholder="Shown to customers" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Type</label><select name="type" className="input"><option value="flat">Flat ₹ off</option><option value="percent">Percent off</option></select></div>
              <div><label className="label">Value</label><input name="value" type="number" min="1" required className="input" /></div>
              <div><label className="label">Min order (₹)</label><input name="minOrder" type="number" min="0" defaultValue={0} className="input" /></div>
              <div><label className="label">Max discount (₹)</label><input name="maxDiscount" type="number" min="1" className="input" placeholder="optional" /></div>
              <div><label className="label">Total uses</label><input name="usageLimit" type="number" min="1" className="input" placeholder="unlimited" /></div>
              <div><label className="label">Per customer</label><input name="perUserLimit" type="number" min="1" defaultValue={1} className="input" /></div>
            </div>
            <div><label className="label">Valid until (optional)</label><input name="validUntil" type="date" className="input" /></div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
