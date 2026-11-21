import { handler, json } from "@/lib/api";
import { ensureSeeded } from "@/lib/bootstrap";
import { getCategories, getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await ensureSeeded();
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return json({ products, categories });
});
