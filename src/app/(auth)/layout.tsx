import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <Providers config={{ deliveryFee: settings.deliveryFee, freeDeliveryAbove: settings.freeDeliveryAbove, minOrder: settings.minOrder }}>
      <div className="flex min-h-screen flex-col justify-center bg-surface py-12 sm:px-6 lg:px-8">
        <main className="flex-1 flex items-center justify-center">{children}</main>
      </div>
    </Providers>
  );
}
