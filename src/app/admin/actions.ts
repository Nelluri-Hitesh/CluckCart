"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  categories,
  coupons,
  deliverySlots,
  deliveryStaff,
  deliveryZones,
  inventory,
  orderItems,
  productImages,
  productVariants,
  products,
  profiles,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assignDelivery, cancelOrder, initiateRefund, processRefund, updateOrderStatus } from "@/lib/orders";
import { hashPassword } from "@/lib/password";
import { requireApi } from "@/lib/session";
import { saveSettings, getSettings } from "@/lib/settings";
import { clean, isPincode, isUuid, normalizeEmail, normalizePhone, passwordProblem, slugify } from "@/lib/validation";

export type ActionState = { error?: string; ok?: string } | null;

function bust() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

async function admin() {
  return requireApi(["admin"]);
}

/** Runs a form action, turning AppErrors into inline messages (redirects and bugs still propagate). */
async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn();
    bust();
    return { ok: ok || "Saved" };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    const code = (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") return { error: "That value already exists (duplicate)." };
    throw e;
  }
}

const num = (v: FormDataEntryValue | number | null, label: string, min = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new AppError(`${label} is invalid`);
  return n;
};
const int = (v: FormDataEntryValue | number | null, label: string, min = 0) => {
  const n = num(v, label, min);
  if (!Number.isInteger(n)) throw new AppError(`${label} must be a whole number`);
  return n;
};

/* ---------------- Products ---------------- */

export async function saveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  let redirectTo: string | null = null;
  const res = await run(async () => {
    const id = String(fd.get("id") || "");
    const name = clean(fd.get("name"), 120);
    if (name.length < 2) throw new AppError("Enter the product name");
    const categoryId = String(fd.get("categoryId") || "");
    if (!isUuid(categoryId)) throw new AppError("Choose a category");
    const pricePerKg = num(fd.get("pricePerKg"), "Price per kg", 1);
    const mrpPerKg = num(fd.get("mrpPerKg"), "MRP per kg", 1);
    if (mrpPerKg < pricePerKg) throw new AppError("MRP cannot be lower than the selling price");
    const minGrams = int(fd.get("minGrams"), "Minimum weight", 50);
    const stepGrams = int(fd.get("stepGrams"), "Weight step", 10);
    const maxGrams = int(fd.get("maxGrams"), "Maximum weight", minGrams);
    const stockGrams = Math.round(num(fd.get("stockKg"), "Stock", 0) * 1000);
    const lowStockGrams = Math.round(num(fd.get("lowStockKg"), "Low-stock alert", 0) * 1000);
    const variants = [...new Set(String(fd.get("variants") || "").split(/[,\s]+/).filter(Boolean).map(Number))];
    if (variants.some((g) => !Number.isInteger(g) || g < 50 || g > 20000)) throw new AppError("Weight options must be grams, e.g. 250, 500, 1000");
    const imageUrl = clean(fd.get("imageUrl"), 500) || "/images/whole.jpg";
    if (!/^(\/|https:\/\/)/.test(imageUrl)) throw new AppError("Image must be an uploaded file or an https:// link");
    const extra = String(fd.get("extraImages") || "").split("\n").map((s) => s.trim()).filter((s) => /^(\/|https:\/\/)/.test(s)).slice(0, 6);

    const values = {
      name,
      categoryId,
      description: clean(fd.get("description"), 1000),
      imageUrl,
      pricePerKg,
      mrpPerKg,
      minGrams,
      stepGrams,
      maxGrams,
      allowCustomWeight: fd.get("allowCustomWeight") === "on",
      pieceInfo: clean(fd.get("pieceInfo"), 120) || null,
      isFeatured: fd.get("isFeatured") === "on",
      isActive: fd.get("isActive") === "on",
      updatedAt: new Date(),
    };
    await db.transaction(async (tx) => {
      let pid = id;
      if (isUuid(id)) {
        await tx.update(products).set(values).where(eq(products.id, id));
      } else {
        const base = slugify(name) || "product";
        let slug = base;
        for (let i = 2; (await tx.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1)).length; i++) slug = `${base}-${i}`;
        [{ id: pid }] = await tx.insert(products).values({ ...values, slug }).returning({ id: products.id });
      }
      await tx.delete(productVariants).where(eq(productVariants.productId, pid));
      if (variants.length) {
        await tx.insert(productVariants).values(
          variants.sort((a, b) => a - b).map((g, i) => ({ productId: pid, grams: g, sortOrder: i, label: g >= 1000 ? `${g / 1000} kg` : `${g} g` })),
        );
      }
      await tx.delete(productImages).where(eq(productImages.productId, pid));
      if (extra.length) await tx.insert(productImages).values(extra.map((url, i) => ({ productId: pid, url, sortOrder: i + 1, alt: name })));
      await tx
        .insert(inventory)
        .values({ productId: pid, stockGrams, lowStockGrams })
        .onConflictDoUpdate({ target: inventory.productId, set: { stockGrams, lowStockGrams, updatedAt: new Date() } });
    });
    redirectTo = "/admin/products";
    return "Product saved";
  });
  if (redirectTo && res?.ok) redirect(redirectTo);
  return res;
}

export async function setProductActive(id: string, active: boolean) {
  await admin();
  if (!isUuid(id)) return;
  await db.update(products).set({ isActive: active, updatedAt: new Date() }).where(eq(products.id, id));
  bust();
}

export async function deleteProduct(id: string) {
  await admin();
  if (!isUuid(id)) return;
  const used = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.productId, id)).limit(1);
  if (used.length) await db.update(products).set({ isActive: false }).where(eq(products.id, id)); // keep history, just hide
  else await db.delete(products).where(eq(products.id, id));
  bust();
}

export async function setStock(productId: string, fd: FormData) {
  await admin();
  if (!isUuid(productId)) return;
  const stockGrams = Math.round(num(fd.get("stockKg"), "Stock", 0) * 1000);
  const lowStockGrams = Math.round(num(fd.get("lowStockKg"), "Low-stock alert", 0) * 1000);
  await db
    .insert(inventory)
    .values({ productId, stockGrams, lowStockGrams })
    .onConflictDoUpdate({ target: inventory.productId, set: { stockGrams, lowStockGrams, updatedAt: new Date() } });
  bust();
}

/* ---------------- Categories ---------------- */

export async function saveCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  return run(async () => {
    const id = String(fd.get("id") || "");
    const name = clean(fd.get("name"), 80);
    if (name.length < 2) throw new AppError("Enter a category name");
    const imageUrl = clean(fd.get("imageUrl"), 500) || null;
    if (imageUrl && !/^(\/|https:\/\/)/.test(imageUrl)) throw new AppError("Image must be an uploaded file or an https:// link");
    const values = { name, description: clean(fd.get("description"), 200) || null, imageUrl, sortOrder: int(fd.get("sortOrder") || 0, "Sort order"), isActive: fd.get("isActive") === "on" };
    if (isUuid(id)) await db.update(categories).set(values).where(eq(categories.id, id));
    else await db.insert(categories).values({ ...values, slug: slugify(name) || `cat-${Date.now()}` });
    return "Category saved";
  });
}

/* ---------------- Orders ---------------- */

export async function setOrderStatus(orderId: string, fd: FormData) {
  const a = await admin();
  await updateOrderStatus(orderId, String(fd.get("status")), { id: a.id, role: "admin" }, clean(fd.get("note"), 200) || null);
  bust();
}

export async function assignOrder(orderId: string, fd: FormData) {
  const a = await admin();
  const staffId = String(fd.get("staffId") || "");
  if (!isUuid(staffId)) throw new AppError("Choose a delivery partner");
  await assignDelivery(orderId, staffId, a.id);
  bust();
}

export async function cancelOrderAdmin(orderId: string, fd: FormData) {
  const a = await admin();
  await cancelOrder(orderId, { id: a.id, role: "admin" }, clean(fd.get("reason"), 200) || "Cancelled by shop");
  bust();
}

export async function refundOrder(orderId: string, fd: FormData) {
  const a = await admin();
  const r = await initiateRefund(orderId, num(fd.get("amount"), "Amount", 1), clean(fd.get("reason"), 200), a.id);
  await processRefund(r.id);
  bust();
}

export async function processRefundAction(refundId: string) {
  await admin();
  await processRefund(refundId);
  bust();
}

/* ---------------- Customers & staff ---------------- */

export async function setUserActive(userId: string, active: boolean) {
  const a = await admin();
  if (!isUuid(userId) || userId === a.id) return; // never lock yourself out
  await db.update(profiles).set({ isActive: active, updatedAt: new Date() }).where(and(eq(profiles.id, userId), sql`${profiles.role} <> 'admin'`));
  bust();
}

export async function createStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  return run(async () => {
    const name = clean(fd.get("name"), 80);
    const phone = normalizePhone(fd.get("phone"));
    const emailRaw = clean(fd.get("email"), 120);
    const email = emailRaw ? normalizeEmail(emailRaw) : null;
    if (name.length < 2) throw new AppError("Enter the staff member's name");
    if (!phone) throw new AppError("Enter a valid 10-digit mobile number");
    if (emailRaw && !email) throw new AppError("Enter a valid email");
    const pw = passwordProblem(fd.get("password"));
    if (pw) throw new AppError(pw);
    const dup = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.phone, phone)).limit(1);
    if (dup.length) throw new AppError("An account with this mobile number already exists");
    await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(profiles)
        .values({ name, phone, email, passwordHash: await hashPassword(String(fd.get("password"))), role: "delivery" })
        .returning({ id: profiles.id });
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(deliveryStaff);
      await tx.insert(deliveryStaff).values({ profileId: p.id, employeeCode: clean(fd.get("employeeCode"), 20) || `DS-${String(n + 1).padStart(3, "0")}`, vehicleNumber: clean(fd.get("vehicleNumber"), 20) || null });
    });
    return `Delivery account created. They can log in with ${phone}.`;
  });
}

/* ---------------- Coupons ---------------- */

export async function saveCoupon(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  return run(async () => {
    const code = clean(fd.get("code"), 30).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 3) throw new AppError("Coupon code must be at least 3 letters/numbers");
    const type = fd.get("type") === "percent" ? "percent" : "flat";
    const value = num(fd.get("value"), "Value", 1);
    if (type === "percent" && value > 100) throw new AppError("Percentage cannot exceed 100");
    const maxRaw = String(fd.get("maxDiscount") || "");
    const limitRaw = String(fd.get("usageLimit") || "");
    const until = String(fd.get("validUntil") || "");
    await db.insert(coupons).values({
      code,
      description: clean(fd.get("description"), 160),
      type,
      value,
      minOrder: num(fd.get("minOrder") || 0, "Minimum order"),
      maxDiscount: maxRaw ? num(maxRaw, "Max discount", 1) : null,
      usageLimit: limitRaw ? int(limitRaw, "Usage limit", 1) : null,
      perUserLimit: int(fd.get("perUserLimit") || 1, "Per-user limit", 1),
      validUntil: until ? new Date(`${until}T23:59:59+05:30`) : null,
    });
    return `Coupon ${code} created`;
  });
}

export async function setCouponActive(id: string, active: boolean) {
  await admin();
  if (isUuid(id)) await db.update(coupons).set({ isActive: active }).where(eq(coupons.id, id));
  bust();
}

/* ---------------- Settings, zones, slots ---------------- */

export async function saveBusinessSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  return run(async () => {
    const cur = await getSettings();
    const time = (k: string) => {
      const v = String(fd.get(k) || "");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new AppError("Enter valid opening hours");
      return v;
    };
    await saveSettings({
      ...cur,
      shopName: clean(fd.get("shopName"), 60) || cur.shopName,
      shopOpen: fd.get("shopOpen") === "on",
      openTime: time("openTime"),
      closeTime: time("closeTime"),
      deliveryFee: num(fd.get("deliveryFee"), "Delivery fee"),
      freeDeliveryAbove: num(fd.get("freeDeliveryAbove"), "Free delivery threshold"),
      minOrder: num(fd.get("minOrder"), "Minimum order"),
      codMaxOrder: num(fd.get("codMaxOrder"), "COD limit"),
      taxPercent: num(fd.get("taxPercent"), "Tax %"),
      gstin: clean(fd.get("gstin"), 20),
      phone: clean(fd.get("phone"), 30),
      email: clean(fd.get("email"), 100),
      whatsapp: clean(fd.get("whatsapp"), 30),
      address: clean(fd.get("address"), 200),
      slotLeadMinutes: int(fd.get("slotLeadMinutes"), "Slot lead time"),
      paymentTimeoutMinutes: int(fd.get("paymentTimeoutMinutes"), "Payment timeout", 5),
    });
    return "Settings saved";
  });
}

export async function addZone(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  return run(async () => {
    const pincode = String(fd.get("pincode") || "").trim();
    if (!isPincode(pincode)) throw new AppError("Enter a valid 6-digit PIN code");
    const area = clean(fd.get("areaName"), 80);
    if (!area) throw new AppError("Enter the area name");
    const feeRaw = String(fd.get("deliveryFee") || "");
    await db.insert(deliveryZones).values({ pincode, areaName: area, deliveryFee: feeRaw ? num(feeRaw, "Delivery fee") : null });
    return `${pincode} added`;
  });
}

export async function setZoneActive(id: string, active: boolean) {
  await admin();
  if (isUuid(id)) await db.update(deliveryZones).set({ isActive: active }).where(eq(deliveryZones.id, id));
  bust();
}

export async function deleteZone(id: string) {
  await admin();
  if (isUuid(id)) await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
  bust();
}

export async function addSlot(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  return run(async () => {
    const start = String(fd.get("startTime") || "");
    const end = String(fd.get("endTime") || "");
    if (!/^\d\d:\d\d$/.test(start) || !/^\d\d:\d\d$/.test(end) || end <= start) throw new AppError("End time must be after start time");
    const fmt = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    };
    await db.insert(deliverySlots).values({ label: `${fmt(start)} – ${fmt(end)}`, startTime: start, endTime: end, capacity: int(fd.get("capacity"), "Capacity", 1) });
    return "Slot added";
  });
}

export async function setSlotActive(id: string, active: boolean) {
  await admin();
  if (isUuid(id)) await db.update(deliverySlots).set({ isActive: active }).where(eq(deliverySlots.id, id));
  bust();
}
