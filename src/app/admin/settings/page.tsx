import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { deliverySlots, deliveryZones } from "@/db/schema";
import { ActionForm, Badge, ConfirmButton, PageHeader } from "@/components/admin-ui";
import { inr } from "@/lib/format";
import { razorpayConfig } from "@/lib/razorpay";
import { getSettings } from "@/lib/settings";
import { addSlot, addZone, deleteZone, saveBusinessSettings, setSlotActive, setZoneActive } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

const F = ({ label, name, type = "text", value, step, hint }: { label: string; name: string; type?: string; value: string | number; step?: string; hint?: string }) => (
  <div><label className="label">{label}</label><input name={name} type={type} step={step} defaultValue={value} required className="input" />{hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}</div>
);

export default async function SettingsAdmin() {
  const [s, zones, slots] = await Promise.all([getSettings(), db.select().from(deliveryZones).orderBy(asc(deliveryZones.pincode)), db.select().from(deliverySlots).orderBy(asc(deliverySlots.startTime))]);
  const mode = razorpayConfig().mode;
  return (
    <>
      <PageHeader title="Business settings" subtitle="Changes apply to the storefront immediately." />
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card p-5 shadow-sm xl:col-span-2">
          <ActionForm action={saveBusinessSettings} className="space-y-5">
            <h2 className="font-extrabold">Shop</h2>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="shopOpen" defaultChecked={s.shopOpen} className="h-4 w-4 accent-[#14412b]" /> Accepting orders (turn off to pause the shop)</label>
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="Shop name" name="shopName" value={s.shopName} />
              <F label="Opens" name="openTime" type="time" value={s.openTime} />
              <F label="Closes" name="closeTime" type="time" value={s.closeTime} />
            </div>
            <h2 className="font-extrabold">Delivery & orders</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="Delivery fee (₹)" name="deliveryFee" type="number" value={s.deliveryFee} />
              <F label="Free delivery above (₹)" name="freeDeliveryAbove" type="number" value={s.freeDeliveryAbove} hint="0 = never free" />
              <F label="Minimum order (₹)" name="minOrder" type="number" value={s.minOrder} />
              <F label="COD limit (₹)" name="codMaxOrder" type="number" value={s.codMaxOrder} />
              <F label="Slot lead time (min)" name="slotLeadMinutes" type="number" value={s.slotLeadMinutes} hint="Today's slots close this long before they start" />
              <F label="Unpaid online order expires (min)" name="paymentTimeoutMinutes" type="number" value={s.paymentTimeoutMinutes} />
            </div>
            <h2 className="font-extrabold">Tax</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="GST % included in prices" name="taxPercent" type="number" step="0.01" value={s.taxPercent} hint="Fresh unprocessed chicken is generally GST-exempt (0%). Confirm with your accountant." />
              <div><label className="label">GSTIN (optional)</label><input name="gstin" defaultValue={s.gstin} className="input" /></div>
            </div>
            <h2 className="font-extrabold">Contact information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Phone" name="phone" value={s.phone} /><F label="WhatsApp" name="whatsapp" value={s.whatsapp} />
              <F label="Email" name="email" type="email" value={s.email} /><F label="Address" name="address" value={s.address} />
            </div>
          </ActionForm>
        </section>

        <div className="space-y-5">
          <section className="card p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-extrabold">Payment gateway</h2>
            <Badge tone={mode === "live" ? "green" : "amber"}>{mode === "live" ? "LIVE" : mode === "test" ? "TEST mode" : "DEMO (no keys)"}</Badge>
            <p className="mt-2 text-xs text-muted">Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET in the server environment. Keys starting <code>rzp_test_</code> are test mode, <code>rzp_live_</code> are live.</p>
          </section>

          <section className="card p-5 shadow-sm">
            <h2 className="mb-3 font-extrabold">Delivery slots</h2>
            <ul className="space-y-2 text-sm">
              {slots.map((sl) => (
                <li key={sl.id} className="flex items-center justify-between gap-2"><span className={sl.isActive ? "" : "text-muted line-through"}>{sl.label} <span className="text-xs text-muted">· {sl.capacity} orders</span></span><form action={setSlotActive.bind(null, sl.id, !sl.isActive)}><button className="text-xs font-semibold text-brand">{sl.isActive ? "Disable" : "Enable"}</button></form></li>
              ))}
            </ul>
            <ActionForm action={addSlot} className="mt-4 space-y-2 border-t border-line pt-4" resetOnSuccess>
              <div className="grid grid-cols-3 gap-2"><div><label className="label">From</label><input name="startTime" type="time" required className="input px-2" /></div><div><label className="label">To</label><input name="endTime" type="time" required className="input px-2" /></div><div><label className="label">Orders</label><input name="capacity" type="number" min="1" defaultValue={30} className="input px-2" /></div></div>
            </ActionForm>
          </section>

          <section className="card p-5 shadow-sm">
            <h2 className="mb-1 font-extrabold">Service areas (PIN codes)</h2>
            <p className="mb-3 text-xs text-muted">We only deliver to PIN codes listed here. An optional fee overrides the default delivery fee ({inr(s.deliveryFee)}).</p>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-2"><span className={z.isActive ? "" : "text-muted line-through"}><b>{z.pincode}</b> {z.areaName}{z.deliveryFee != null && <span className="text-xs text-muted"> · {inr(z.deliveryFee)}</span>}</span>
                  <span className="flex gap-2 text-xs font-semibold"><form action={setZoneActive.bind(null, z.id, !z.isActive)}><button className="text-brand">{z.isActive ? "Pause" : "Enable"}</button></form><form action={deleteZone.bind(null, z.id)}><ConfirmButton message={`Remove ${z.pincode}?`} className="text-red-600">Remove</ConfirmButton></form></span></li>
              ))}
            </ul>
            <ActionForm action={addZone} className="mt-4 space-y-2 border-t border-line pt-4" resetOnSuccess>
              <div className="grid grid-cols-2 gap-2"><div><label className="label">PIN code</label><input name="pincode" required inputMode="numeric" maxLength={6} className="input" /></div><div><label className="label">Fee override (₹)</label><input name="deliveryFee" type="number" min="0" className="input" placeholder="optional" /></div></div>
              <div><label className="label">Area name</label><input name="areaName" required className="input" /></div>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
