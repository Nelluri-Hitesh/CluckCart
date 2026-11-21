import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses } from "@/db/schema";
import { CheckoutForm } from "@/components/checkout-form";
import { razorpayConfig } from "@/lib/razorpay";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getAvailableSlots } from "@/lib/slots";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requirePage(["customer"], "/checkout");
  const [addresses, slots, settings] = await Promise.all([
    db.select().from(customerAddresses).where(eq(customerAddresses.userId, user.id)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt)),
    getAvailableSlots(),
    getSettings(),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight md:text-3xl">Checkout</h1>
      <CheckoutForm
        user={{ name: user.name, phone: user.phone }}
        addresses={addresses}
        slots={slots}
        codMax={settings.codMaxOrder}
        paymentMode={razorpayConfig().mode}
        shopOpen={settings.shopOpen}
      />
    </div>
  );
}
