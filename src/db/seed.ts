import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  coupons,
  deliverySlots,
  deliveryStaff,
  deliveryZones,
  inventory,
  productVariants,
  products,
  profiles,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { defaultSettings, saveSettings } from "@/lib/settings";

const CATEGORIES = [
  ["Fresh Chicken", "fresh-chicken", "/images/whole.jpg", "Whole birds, farm fresh"],
  ["Fry Cut", "fry-cut", "/images/fry-cut.jpg", "Small bone-in pieces for frying"],
  ["Curry Cut", "curry-cut", "/images/curry-cut.jpg", "Medium bone-in pieces for curries"],
  ["Boneless", "boneless", "/images/boneless.jpg", "Cleaned boneless chicken"],
  ["Chicken Breast", "chicken-breast", "/images/breast.jpg", "Lean breast fillets"],
  ["Chicken Legs", "chicken-legs", "/images/legs.jpg", "Whole leg pieces"],
  ["Chicken Thighs", "chicken-thighs", "/images/thighs.jpg", "Juicy thigh cuts"],
  ["Chicken Wings", "chicken-wings", "/images/wings.jpg", "Wings for grilling and frying"],
  ["Drumsticks", "chicken-drumsticks", "/images/legs.jpg", "Classic drumsticks"],
  ["Chicken Liver", "chicken-liver", "/images/liver.jpg", "Fresh liver and organ meat"],
  ["Other Chicken", "other-chicken", "/images/boneless.jpg", "Keema, gizzards and more"],
] as const;

// name, slug, category, price/kg, mrp/kg, image, description, pieceInfo, featured, stock(kg), variants
type P = [string, string, string, number, number, string, string, string, boolean, number, number[]];
const PRODUCTS: P[] = [
  ["Whole Chicken with Skin", "whole-chicken-with-skin", "fresh-chicken", 229, 259, "/images/whole.jpg", "Farm-fresh broiler, cleaned and ready to cut. Perfect for roasting and tandoori.", "Approx. 1.2 – 1.5 kg bird", true, 60, [1000, 1500, 2000]],
  ["Whole Chicken Skinless", "whole-chicken-skinless", "fresh-chicken", 249, 279, "/images/whole.jpg", "Skin removed, trimmed and cleaned for a lighter cook.", "Approx. 1 – 1.3 kg", false, 45, [1000, 1500]],
  ["Chicken Fry Cut (Bone-in)", "chicken-fry-cut", "fry-cut", 259, 289, "/images/fry-cut.jpg", "Small, even bone-in pieces that crisp up beautifully for Andhra-style fry.", "Approx. 20 – 24 pieces / kg", true, 55, [250, 500, 1000]],
  ["Chicken Fry Cut Skinless", "chicken-fry-cut-skinless", "fry-cut", 279, 309, "/images/fry-cut.jpg", "Skinless small pieces — lean and quick-cooking.", "Approx. 20 – 24 pieces / kg", false, 40, [250, 500, 1000]],
  ["Chicken Curry Cut with Skin", "chicken-curry-cut", "curry-cut", 239, 269, "/images/curry-cut.jpg", "Medium bone-in pieces with skin for rich, flavourful curries and biryani.", "Approx. 12 – 16 pieces / kg", true, 80, [250, 500, 1000, 2000]],
  ["Chicken Curry Cut Skinless", "chicken-curry-cut-skinless", "curry-cut", 269, 299, "/images/curry-cut.jpg", "Our bestselling curry cut, skin removed and washed.", "Approx. 12 – 16 pieces / kg", true, 70, [250, 500, 1000, 2000]],
  ["Boneless Chicken Cubes", "boneless-chicken", "boneless", 399, 449, "/images/boneless.jpg", "100% boneless, trimmed and cubed. Ideal for tikka, 65 and stir-fries.", "Approx. 30 – 35 cubes / kg", true, 40, [250, 500, 1000]],
  ["Chicken Keema (Mince)", "chicken-keema", "other-chicken", 429, 479, "/images/boneless.jpg", "Freshly minced boneless chicken — great for kebabs, samosas and keema curry.", "Minced to order", false, 25, [250, 500, 1000]],
  ["Chicken Breast Boneless", "chicken-breast-boneless", "chicken-breast", 379, 419, "/images/breast.jpg", "Lean, high-protein breast fillets, skinless and boneless.", "Approx. 3 – 4 fillets / kg", true, 35, [250, 500, 1000]],
  ["Chicken Breast Cubes", "chicken-breast-cubes", "chicken-breast", 399, 439, "/images/breast.jpg", "Breast meat pre-cut into bite-size cubes.", "Approx. 35 cubes / kg", false, 20, [250, 500, 1000]],
  ["Chicken Leg Pieces", "chicken-leg-pieces", "chicken-legs", 249, 279, "/images/legs.jpg", "Whole bone-in leg quarters, juicy and full of flavour.", "Approx. 3 – 4 legs / kg", false, 40, [500, 1000, 2000]],
  ["Chicken Drumsticks", "chicken-drumsticks", "chicken-drumsticks", 269, 299, "/images/legs.jpg", "Classic drumsticks with skin — grill, bake or fry.", "Approx. 6 – 8 pieces / kg", true, 40, [250, 500, 1000]],
  ["Boneless Chicken Thigh", "boneless-chicken-thigh", "chicken-thighs", 389, 429, "/images/thighs.jpg", "Succulent boneless thigh meat that stays tender in every dish.", "Approx. 5 – 6 pieces / kg", true, 30, [250, 500, 1000]],
  ["Chicken Thigh Bone-in", "chicken-thigh-bone-in", "chicken-thighs", 259, 289, "/images/thighs.jpg", "Bone-in thighs with skin — the best cut for roasting.", "Approx. 5 – 6 pieces / kg", false, 30, [500, 1000]],
  ["Chicken Wings", "chicken-wings", "chicken-wings", 229, 259, "/images/wings.jpg", "Fresh wings, cleaned and tipped. Ready for BBQ or buffalo.", "Approx. 10 – 12 pieces / kg", true, 30, [250, 500, 1000]],
  ["Chicken Liver", "chicken-liver", "chicken-liver", 189, 209, "/images/liver.jpg", "Fresh, cleaned chicken liver — rich in iron. Packed daily.", "Cleaned and trimmed", false, 3, [250, 500]],
  ["Chicken Gizzard", "chicken-gizzard", "other-chicken", 179, 199, "/images/liver.jpg", "Cleaned gizzards (podi) — a Hyderabadi favourite for fry.", "Cleaned and trimmed", false, 15, [250, 500]],
  ["Country Chicken (Natu Kodi)", "country-chicken", "fresh-chicken", 549, 599, "/images/whole.jpg", "Free-range country chicken with a firmer bite and deep flavour.", "Cut to order · limited daily stock", true, 0, [500, 1000]],
];

export async function runSeed() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(categories);
  if (n === 0) {
    const cats = await db
      .insert(categories)
      .values(CATEGORIES.map(([name, slug, imageUrl, description], i) => ({ name, slug, imageUrl, description, sortOrder: i })))
      .returning();
    const catId = new Map(cats.map((c) => [c.slug, c.id]));
    for (const [name, slug, cat, price, mrp, img, desc, pieceInfo, featured, stockKg, variants] of PRODUCTS) {
      const [p] = await db
        .insert(products)
        .values({
          name,
          slug,
          categoryId: catId.get(cat)!,
          pricePerKg: price,
          mrpPerKg: mrp,
          imageUrl: img,
          description: desc,
          pieceInfo,
          isFeatured: featured,
        })
        .returning();
      await db.insert(inventory).values({ productId: p.id, stockGrams: stockKg * 1000, lowStockGrams: 5000 });
      await db.insert(productVariants).values(
        variants.map((g, i) => ({ productId: p.id, grams: g, label: g >= 1000 ? `${g / 1000} kg` : `${g} g`, sortOrder: i })),
      );
    }
    await db.insert(coupons).values([
      { code: "FIRST50", description: "₹50 off on your first order above ₹299", type: "flat", value: 50, minOrder: 299, perUserLimit: 1 },
      { code: "CHICKEN10", description: "10% off up to ₹100 on orders above ₹499", type: "percent", value: 10, minOrder: 499, maxDiscount: 100, perUserLimit: 5 },
      { code: "FREESHIP", description: "₹40 off on orders above ₹399", type: "flat", value: 40, minOrder: 399, perUserLimit: 3 },
    ]);
    // Development defaults for Hyderabad — verify against the areas you really serve.
    const zones: [string, string][] = [
      ["500001", "Abids / Nampally"], ["500003", "Secunderabad"], ["500004", "Khairatabad"], ["500008", "Tolichowki"],
      ["500016", "Begumpet"], ["500018", "Sanath Nagar"], ["500020", "Himayatnagar"], ["500026", "Musheerabad"],
      ["500028", "Hyderguda"], ["500032", "Gachibowli"], ["500033", "Jubilee Hills"], ["500034", "Banjara Hills"],
      ["500038", "Ameerpet"], ["500049", "Kondapur"], ["500050", "Chandanagar"], ["500072", "Kukatpally"],
      ["500081", "Madhapur / HITEC City"], ["500084", "Kondapur / Miyapur"], ["500085", "Nizampet / Bachupally"],
    ];
    await db.insert(deliveryZones).values(zones.map(([pincode, areaName]) => ({ pincode, areaName })));
    await db.insert(deliverySlots).values([
      { label: "7:00 AM – 9:00 AM", startTime: "07:00", endTime: "09:00", capacity: 20 },
      { label: "9:00 AM – 11:00 AM", startTime: "09:00", endTime: "11:00", capacity: 30 },
      { label: "11:00 AM – 1:00 PM", startTime: "11:00", endTime: "13:00", capacity: 30 },
      { label: "4:00 PM – 6:00 PM", startTime: "16:00", endTime: "18:00", capacity: 30 },
      { label: "6:00 PM – 8:00 PM", startTime: "18:00", endTime: "20:00", capacity: 30 },
    ]);
    await saveSettings(defaultSettings);
  }

  // Accounts. Admin credentials come from env; the defaults below are for local development only.
  const [admin] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, "admin")).limit(1);
  if (!admin) {
    await db.insert(profiles).values({
      name: "Chicken Mart Admin",
      phone: process.env.ADMIN_PHONE || "9000000001",
      email: (process.env.ADMIN_EMAIL || "admin@chickenmart.in").toLowerCase(),
      passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || "Admin@12345"),
      role: "admin",
    });
  }
  if (process.env.SEED_DEMO_USERS !== "false") {
    const [rider] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.phone, "9000000002")).limit(1);
    if (!rider) {
      const [r] = await db
        .insert(profiles)
        .values({ name: "Ravi Kumar", phone: "9000000002", email: "delivery@chickenmart.in", passwordHash: await hashPassword("Delivery@123"), role: "delivery" })
        .returning();
      await db.insert(deliveryStaff).values({ profileId: r.id, employeeCode: "DS-001", vehicleNumber: "TS09 AB 1234" });
    }
    const [cust] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.phone, "9000000003")).limit(1);
    if (!cust) {
      await db.insert(profiles).values({ name: "Demo Customer", phone: "9000000003", email: "customer@example.com", passwordHash: await hashPassword("Customer@123"), role: "customer" });
    }
  }
}
