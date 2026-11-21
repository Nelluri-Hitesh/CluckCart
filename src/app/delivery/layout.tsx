import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DeliveryShell } from "@/components/delivery-ui";
import { ensureSeeded } from "@/lib/bootstrap";
import { requirePage } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Deliveries", template: "%s · Chicken Mart Delivery" }, robots: { index: false, follow: false } };

export default async function DeliveryLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const user = await requirePage(["delivery"], "/delivery");
  return <DeliveryShell name={user.name}>{children}</DeliveryShell>;
}
