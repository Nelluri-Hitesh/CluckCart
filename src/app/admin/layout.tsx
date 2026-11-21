import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-ui";
import { ensureSeeded } from "@/lib/bootstrap";
import { requirePage } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Chicken Mart Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const user = await requirePage(["admin"], "/admin");
  return (
    <div className="flex min-h-screen flex-col bg-cream lg:flex-row">
      <AdminNav userName={user.name} />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
