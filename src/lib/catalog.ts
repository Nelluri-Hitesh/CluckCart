import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, inventory, productImages, productVariants, products } from "@/db/schema";

export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  images: string[];
  pricePerKg: number;
  mrpPerKg: number;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  variants: number[];
  minGrams: number;
  stepGrams: number;
  maxGrams: number;
  allowCustomWeight: boolean;
  pieceInfo: string | null;
  isFeatured: boolean;
  isActive: boolean;
  stockGrams: number;
  lowStockGrams: number;
  inStock: boolean;
  createdAt: string;
};

export async function getProducts(opts: { includeInactive?: boolean } = {}): Promise<ProductDTO[]> {
  const rows = await db
    .select({
      p: products,
      categorySlug: categories.slug,
      categoryName: categories.name,
      categoryActive: categories.isActive,
      stock: inventory.stockGrams,
      low: inventory.lowStockGrams,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(opts.includeInactive ? undefined : and(eq(products.isActive, true), eq(categories.isActive, true)))
    .orderBy(asc(products.name));

  const variantRows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.isActive, true))
    .orderBy(asc(productVariants.grams));
  const imageRows = await db.select().from(productImages).orderBy(asc(productImages.sortOrder));
  const variantMap = new Map<string, number[]>();
  for (const v of variantRows) variantMap.set(v.productId, [...(variantMap.get(v.productId) ?? []), v.grams]);
  const imageMap = new Map<string, string[]>();
  for (const i of imageRows) imageMap.set(i.productId, [...(imageMap.get(i.productId) ?? []), i.url]);

  return rows.map(({ p, categorySlug, categoryName, stock, low }) => {
    const stockGrams = stock ?? 0;
    const extra = imageMap.get(p.id) ?? [];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      images: [p.imageUrl, ...extra.filter((u) => u !== p.imageUrl)],
      pricePerKg: p.pricePerKg,
      mrpPerKg: p.mrpPerKg,
      categoryId: p.categoryId,
      categorySlug,
      categoryName,
      variants: variantMap.get(p.id) ?? [],
      minGrams: p.minGrams,
      stepGrams: p.stepGrams,
      maxGrams: p.maxGrams,
      allowCustomWeight: p.allowCustomWeight,
      pieceInfo: p.pieceInfo,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      stockGrams,
      lowStockGrams: low ?? 0,
      inStock: stockGrams >= p.minGrams,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

export async function getCategories(onlyActive = true) {
  return db
    .select()
    .from(categories)
    .where(onlyActive ? eq(categories.isActive, true) : undefined)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}
