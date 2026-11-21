import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveryAssignments, deliveryStaff, orders, profiles } from "@/db/schema";
import { ActionForm, Badge, PageHeader, Table } from "@/components/admin-ui";
import { fmtDateTime } from "@/lib/format";
import { createStaff, setUserActive } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delivery" };

export default async function DeliveryAdmin() {
  const [staff, live, recent] = await Promise.all([
    db
      .select({
        id: profiles.id,
        name: profiles.name,
        phone: profiles.phone,
        isActive: profiles.isActive,
        code: deliveryStaff.employeeCode,
        vehicle: deliveryStaff.vehicleNumber,
        active: sql<number>`(select count(*) from delivery_assignments a where a.staff_id = ${profiles.id} and a.status in ('assigned','accepted','out_for_delivery'))::int`,
        done: sql<number>`(select count(*) from delivery_assignments a where a.staff_id = ${profiles.id} and a.status = 'delivered')::int`,
        failed: sql<number>`(select count(*) from delivery_assignments a where a.staff_id = ${profiles.id} and a.status = 'failed')::int`,
      })
      .from(profiles)
      .leftJoin(deliveryStaff, eq(deliveryStaff.profileId, profiles.id))
      .where(eq(profiles.role, "delivery")),
    db
      .select({ a: deliveryAssignments, orderNumber: orders.orderNumber, orderId: orders.id, customer: orders.customerName, pin: sql<string>`${orders.address}->>'pincode'`, staff: profiles.name })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
      .innerJoin(profiles, eq(profiles.id, deliveryAssignments.staffId))
      .where(inArray(deliveryAssignments.status, ["assigned", "accepted", "out_for_delivery"]))
      .orderBy(desc(deliveryAssignments.assignedAt)),
    db
      .select({ a: deliveryAssignments, orderNumber: orders.orderNumber, orderId: orders.id, staff: profiles.name })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(orders.id, deliveryAssignments.orderId))
      .innerJoin(profiles, eq(profiles.id, deliveryAssignments.staffId))
      .where(inArray(deliveryAssignments.status, ["delivered", "failed"]))
      .orderBy(desc(deliveryAssignments.completedAt))
      .limit(15),
  ]);
  return (
    <>
      <PageHeader title="Delivery" subtitle="Your own delivery team. Assign orders from the order page once they are accepted." />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section>
            <h2 className="mb-3 font-extrabold">Delivery staff</h2>
            <Table head={["Name", "Phone", "Code / vehicle", "Active", "Delivered", "Failed", "Status", ""]} empty={staff.length ? undefined : "No delivery staff yet"}>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3 text-muted">+91 {s.phone}</td>
                  <td className="px-4 py-3 text-muted">{s.code}<div className="text-xs">{s.vehicle}</div></td>
                  <td className="px-4 py-3">{s.active}</td><td className="px-4 py-3">{s.done}</td><td className="px-4 py-3">{s.failed}</td>
                  <td className="px-4 py-3">{s.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="px-4 py-3 text-right"><form action={setUserActive.bind(null, s.id, !s.isActive)}><button className="btn-outline py-1.5 text-xs">{s.isActive ? "Deactivate" : "Activate"}</button></form></td>
                </tr>
              ))}
            </Table>
          </section>
          <section>
            <h2 className="mb-3 font-extrabold">Live deliveries</h2>
            <Table head={["Order", "Customer", "PIN", "Partner", "Status"]} empty={live.length ? undefined : "Nothing out for delivery"}>
              {live.map((l) => (
                <tr key={l.a.id}><td className="px-4 py-3 font-semibold"><Link className="text-brand hover:underline" href={`/admin/orders/${l.orderId}`}>{l.orderNumber}</Link></td><td className="px-4 py-3">{l.customer}</td><td className="px-4 py-3 text-muted">{l.pin}</td><td className="px-4 py-3">{l.staff}</td><td className="px-4 py-3"><Badge tone={l.a.status === "out_for_delivery" ? "amber" : "blue"}>{l.a.status.replace(/_/g, " ")}</Badge></td></tr>
              ))}
            </Table>
          </section>
          <section>
            <h2 className="mb-3 font-extrabold">Delivery history</h2>
            <Table head={["Order", "Partner", "Result", "When"]} empty={recent.length ? undefined : "No completed deliveries yet"}>
              {recent.map((l) => (
                <tr key={l.a.id}><td className="px-4 py-3 font-semibold"><Link className="text-brand hover:underline" href={`/admin/orders/${l.orderId}`}>{l.orderNumber}</Link></td><td className="px-4 py-3">{l.staff}</td><td className="px-4 py-3">{l.a.status === "delivered" ? <Badge tone="green">Delivered</Badge> : <Badge tone="red">Failed: {l.a.failureReason}</Badge>}</td><td className="px-4 py-3 text-muted">{l.a.completedAt ? fmtDateTime(l.a.completedAt) : ""}</td></tr>
              ))}
            </Table>
          </section>
        </div>
        <section className="card h-fit p-5 shadow-sm">
          <h2 className="mb-1 font-extrabold">Create delivery account</h2>
          <p className="mb-4 text-xs text-muted">Staff log in at /login with their mobile number and this password. Ask them to change it after first login.</p>
          <ActionForm action={createStaff} className="space-y-3" resetOnSuccess>
            <div><label className="label">Full name</label><input name="name" required className="input" /></div>
            <div><label className="label">Mobile number</label><input name="phone" required inputMode="numeric" className="input" /></div>
            <div><label className="label">Email (optional)</label><input name="email" type="email" className="input" /></div>
            <div><label className="label">Temporary password</label><input name="password" type="text" required minLength={8} autoComplete="off" className="input" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="label">Employee code</label><input name="employeeCode" className="input" placeholder="auto" /></div><div><label className="label">Vehicle no.</label><input name="vehicleNumber" className="input" /></div></div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
