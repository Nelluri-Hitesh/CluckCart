import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Chicken Mart — Fresh chicken delivered in Hyderabad", template: "%s · Chicken Mart" },
  description:
    "Order farm-fresh chicken online in Hyderabad. Curry cut, fry cut, boneless, breast, wings, legs and more — cut to order and delivered to your door.",
  applicationName: "Chicken Mart",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#e23744",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
