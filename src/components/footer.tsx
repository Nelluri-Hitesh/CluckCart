import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { Logo } from "./icons";

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function Footer({ settings, categories }: { settings: Settings; categories: { name: string; slug: string }[] }) {
  return (
    <footer className="mt-16 bg-forest-dark text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Farm-fresh chicken, cut to order and delivered by our own team across Hyderabad.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Shop</h4>
          <ul className="mt-4 space-y-2 text-sm">
            {categories.slice(0, 7).map((c) => (
              <li key={c.slug}><Link className="hover:text-white" href={`/products?category=${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Account</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/orders">Track orders</Link></li>
            <li><Link className="hover:text-white" href="/account">Profile & addresses</Link></li>
            <li><Link className="hover:text-white" href="/login">Log in</Link></li>
            <li><Link className="hover:text-white" href="/register">Create account</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Contact</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>{settings.address}</li>
            <li><a className="hover:text-white" href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a></li>
            <li><a className="hover:text-white" href={`mailto:${settings.email}`}>{settings.email}</a></li>
            <li>Open daily {fmt12(settings.openTime)} – {fmt12(settings.closeTime)}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {settings.shopName}. All prices in INR, inclusive of taxes. Chicken Mart is an independent brand and is not affiliated with any food-delivery platform.
      </div>
    </footer>
  );
}
