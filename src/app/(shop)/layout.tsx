import type { ReactNode } from "react";
import { CartDrawer, StickyCartBar } from "@/components/cart-drawer";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { ensureSeeded } from "@/lib/bootstrap";
import { getCategories } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const [user, settings, categories] = await Promise.all([getCurrentUser(), getSettings(), getCategories()]);
  return (
    <Providers config={{ deliveryFee: settings.deliveryFee, freeDeliveryAbove: settings.freeDeliveryAbove, minOrder: settings.minOrder }}>
      <div className="flex min-h-screen flex-col">
        {!settings.shopOpen && (
          <div className="bg-ink px-4 py-2 text-center text-sm font-medium text-white">
            We&apos;re not accepting new orders right now. You can still browse — please check back soon.
          </div>
        )}
        <Navbar user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
        <Footer settings={settings} categories={categories} />
      </div>
      <CartDrawer />
      <StickyCartBar />
    </Providers>
  );
}
