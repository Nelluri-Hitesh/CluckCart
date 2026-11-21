import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses, notifications, profiles } from "@/db/schema";
import { AddressManager, PasswordForm, ProfileForm } from "@/components/account-client";
import { fmtDateTime } from "@/lib/format";
import { requirePage } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requirePage(["customer"], "/account");
  const [[profile], addresses, notes] = await Promise.all([
    db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, user.id)).limit(1),
    db.select().from(customerAddresses).where(eq(customerAddresses.userId, user.id)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt)),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(15),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">My account</h1>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5"><h2 className="mb-4 text-lg font-extrabold">Profile</h2><ProfileForm name={user.name} phone={user.phone} email={profile?.email ?? null} /></section>
        <section className="card p-5"><h2 className="mb-4 text-lg font-extrabold">Password</h2><PasswordForm /></section>
      </div>
      <section className="card p-5"><h2 className="mb-4 text-lg font-extrabold">Saved addresses</h2><AddressManager initial={addresses} user={{ name: user.name, phone: user.phone }} /></section>
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-extrabold">Notifications</h2>
        {notes.length === 0 ? <p className="text-sm text-muted">Order updates will appear here.</p> : (
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id} className="py-3 text-sm">
                <div className="flex justify-between gap-3"><p className="font-semibold">{n.orderId ? <Link href={`/orders/${n.orderId}`} className="hover:text-brand">{n.title}</Link> : n.title}</p><span className="shrink-0 text-xs text-muted">{fmtDateTime(n.createdAt)}</span></div>
                <p className="text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
