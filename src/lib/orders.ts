import { randomInt } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  couponRedemptions,
  coupons,
  customerAddresses,
  deliveryAssignments,
  deliveryStatusHistory,
  deliveryZones,
  inventory,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  productVariants,
  products,
  refunds,
} from "@/db/schema";
import { AppError } from "./errors";
import { istNow } from "./format";
import { notify } from "./notify";
import { CUSTOMER_CANCELLABLE, STATUS_LABEL, TRANSITIONS } from "./order-status";
import { computeTotals, couponDiscount, deliveryFeeFor, packPrice } from "./pricing";
import { createRazorpayOrder, razorpayConfig, refundRazorpayPayment } from "./razorpay";
import { getSettings, type Settings } from "./settings";
import { getAvailableSlots } from "./slots";
import { clean, isUuid } from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Tx | typeof db;

/* ------------------------------------------------------------------ */
/* Quote                                                               */
/* ------------------------------------------------------------------ */

export type PricedLine = {
  productId: string;
  name: string;
  imageUrl: string;
  grams: number;
  quantity: number;
  pricePerKg: number;
  mrpPerKg: number;
  unitPrice: number;
  lineTotal: number;
};

export type Quote = {
  lines: PricedLine[];
  subtotal: number;
  mrpTotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  couponCode: string | null;
  couponError: string | null;
  issues: string[];
  serviceable: boolean | null;
  zoneName: string | null;
  minOrder: number;
};

function parseItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) throw new AppError("Your cart is empty");
  if (raw.length > 50) throw new AppError("Too many items in the cart");
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const grams = Number(o.grams);
    const quantity = Number(o.quantity);
    if (!isUuid(o.productId) || !Number.isInteger(grams) || !Number.isInteger(quantity) || grams < 1 || quantity < 1 || quantity > 20) {
      throw new AppError("Invalid cart item");
    }
    return { productId: o.productId, grams, quantity };
  });
}

export async function validateCoupon(code: string, subtotal: number, userId: string | null) {
  const normalized = clean(code, 30).toUpperCase();
  const [c] = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!c || !c.isActive) throw new AppError("This coupon code is not valid");
  const now = new Date();
  if (c.validFrom && c.validFrom > now) throw new AppError("This coupon is not active yet");
  if (c.validUntil && c.validUntil < now) throw new AppError("This coupon has expired");
  if (subtotal < c.minOrder) throw new AppError(`Add items worth ₹${Math.ceil(c.minOrder - subtotal)} more to use ${c.code}`);
  if (c.usageLimit != null) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(couponRedemptions).where(eq(couponRedemptions.couponId, c.id));
    if (n >= c.usageLimit) throw new AppError("This coupon has been fully redeemed");
  }
  if (userId) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, c.id), eq(couponRedemptions.userId, userId)));
    if (n >= c.perUserLimit) throw new AppError("You have already used this coupon");
  }
  const rule = { type: c.type as "percent" | "flat", value: c.value, minOrder: c.minOrder, maxDiscount: c.maxDiscount };
  return { id: c.id, code: c.code, discount: couponDiscount(rule, subtotal) };
}

export async function buildQuote(
  input: { items: unknown; couponCode?: string | null; pincode?: string | null; userId?: string | null },
  settings?: Settings,
): Promise<Quote> {
  const s = settings ?? (await getSettings());
  const items = parseItems(input.items);
  const ids = [...new Set(items.map((i) => i.productId))];

  const rows = await db
    .select({ p: products, stock: inventory.stockGrams, catActive: categories.isActive })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(inArray(products.id, ids));
  const variants = await db
    .select({ productId: productVariants.productId, grams: productVariants.grams })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true)));
  const variantMap = new Map<string, Set<number>>();
  for (const v of variants) variantMap.set(v.productId, (variantMap.get(v.productId) ?? new Set()).add(v.grams));
  const byId = new Map(rows.map((r) => [r.p.id, r]));

  const issues: string[] = [];
  const lines: PricedLine[] = [];
  const needed = new Map<string, number>();
  for (const it of items) {
    const row = byId.get(it.productId);
    if (!row || !row.p.isActive || !row.catActive) throw new AppError("An item in your cart is no longer available. Please remove it.");
    const p = row.p;
    const okVariant = variantMap.get(p.id)?.has(it.grams);
    const okCustom = p.allowCustomWeight && it.grams >= p.minGrams && it.grams <= p.maxGrams && it.grams % p.stepGrams === 0;
    if (!okVariant && !okCustom) throw new AppError(`Invalid weight selected for ${p.name}`);
    const unitPrice = packPrice(p.pricePerKg, it.grams);
    lines.push({
      productId: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      grams: it.grams,
      quantity: it.quantity,
      pricePerKg: p.pricePerKg,
      mrpPerKg: p.mrpPerKg,
      unitPrice,
      lineTotal: unitPrice * it.quantity,
    });
    needed.set(p.id, (needed.get(p.id) ?? 0) + it.grams * it.quantity);
  }
  for (const [pid, grams] of needed) {
    const row = byId.get(pid)!;
    if ((row.stock ?? 0) < grams) {
      issues.push(
        (row.stock ?? 0) >= row.p.minGrams
          ? `Only ${((row.stock ?? 0) / 1000).toFixed(2).replace(/\.?0+$/, "")} kg of ${row.p.name} is available`
          : `${row.p.name} is out of stock`,
      );
    }
  }

  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const mrpTotal = lines.reduce((a, l) => a + Math.round((l.mrpPerKg * l.grams) / 1000) * l.quantity, 0);

  let discount = 0;
  let couponCode: string | null = null;
  let couponError: string | null = null;
  if (input.couponCode) {
    try {
      const c = await validateCoupon(input.couponCode, subtotal, input.userId ?? null);
      discount = c.discount;
      couponCode = c.code;
    } catch (e) {
      if (e instanceof AppError) couponError = e.message;
      else throw e;
    }
  }

  let serviceable: boolean | null = null;
  let zoneName: string | null = null;
  let baseFee = s.deliveryFee;
  if (input.pincode) {
    const [zone] = await db.select().from(deliveryZones).where(and(eq(deliveryZones.pincode, input.pincode), eq(deliveryZones.isActive, true))).limit(1);
    serviceable = !!zone;
    zoneName = zone?.areaName ?? null;
    if (zone?.deliveryFee != null) baseFee = zone.deliveryFee;
  }
  const deliveryFee = deliveryFeeFor(subtotal - discount, baseFee, s.freeDeliveryAbove);
  const { tax, total } = computeTotals({ subtotal, discount, deliveryFee, taxPercent: s.taxPercent });

  return { lines, subtotal, mrpTotal, discount, deliveryFee, tax, total, couponCode, couponError, issues, serviceable, zoneName, minOrder: s.minOrder };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function pgCode(e: unknown): { code?: string; constraint?: string } {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  return { code: err?.code ?? err?.cause?.code, constraint: err?.constraint ?? err?.cause?.constraint };
}

function newOrderNumber() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[randomInt(alphabet.length)];
  return `CM${istNow().date.replace(/-/g, "").slice(2)}-${s}`;
}

async function addHistory(ex: Executor, orderId: string, status: string, note?: string | null, actorId?: string | null) {
  await ex.insert(orderStatusHistory).values({ orderId, status, note: note ?? null, actorId: actorId ?? null });
}

/* ------------------------------------------------------------------ */
/* Create order                                                        */
/* ------------------------------------------------------------------ */

export type CreateOrderInput = {
  userId: string;
  items: unknown;
  addressId: string;
  slotKey: string;
  paymentMethod: string;
  couponCode?: string | null;
  idempotencyKey: string;
  notes?: string | null;
};

export async function createOrder(input: CreateOrderInput) {
  await expireStaleOrders();
  const settings = await getSettings();
  if (!settings.shopOpen) throw new AppError("We are not taking orders right now. Please check back soon.", 409);
  if (input.paymentMethod !== "online" && input.paymentMethod !== "cod") throw new AppError("Choose a payment method");
  const idem = clean(input.idempotencyKey, 80);
  if (idem.length < 8) throw new AppError("Missing idempotency key");

  // Duplicate submit (double click / retry): return the order that was already created.
  const [existing] = await db.select().from(orders).where(and(eq(orders.userId, input.userId), eq(orders.idempotencyKey, idem))).limit(1);
  if (existing) return existing;

  if (!isUuid(input.addressId)) throw new AppError("Choose a delivery address");
  const [address] = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.id, input.addressId), eq(customerAddresses.userId, input.userId)))
    .limit(1);
  if (!address) throw new AppError("Delivery address not found");

  const quote = await buildQuote({ items: input.items, couponCode: input.couponCode, pincode: address.pincode, userId: input.userId }, settings);
  if (!quote.serviceable) throw new AppError(`Sorry, we do not deliver to PIN code ${address.pincode} yet`);
  if (quote.couponError) throw new AppError(quote.couponError);
  if (quote.issues.length) throw new AppError(quote.issues[0], 409);
  if (quote.subtotal < settings.minOrder) throw new AppError(`Minimum order is ₹${settings.minOrder}`);
  if (input.paymentMethod === "cod" && quote.total > settings.codMaxOrder) {
    throw new AppError(`Cash on delivery is available up to ₹${settings.codMaxOrder}. Please pay online.`);
  }

  const slots = await getAvailableSlots();
  const slot = slots.find((s) => s.key === input.slotKey);
  if (!slot) throw new AppError("Please choose a delivery slot", 409);
  if (slot.remaining < 1) throw new AppError("That delivery slot is full. Please choose another.", 409);

  const needed = new Map<string, number>();
  for (const l of quote.lines) needed.set(l.productId, (needed.get(l.productId) ?? 0) + l.grams * l.quantity);
  const coupon = quote.couponCode
    ? (await db.select().from(coupons).where(eq(coupons.code, quote.couponCode)).limit(1))[0]
    : undefined;
  const cfg = razorpayConfig();
  const provider = input.paymentMethod === "cod" ? "cod" : cfg.mode === "demo" ? "demo" : "razorpay";
  const snapshot = {
    recipientName: address.recipientName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    area: address.area,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    latitude: address.latitude,
    longitude: address.longitude,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await db.transaction(async (tx) => {
        // Atomic stock reservation: the UPDATE only succeeds while enough stock remains,
        // so two shoppers can never both buy the last kilo.
        for (const [productId, grams] of [...needed.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          const res = await tx
            .update(inventory)
            .set({ stockGrams: sql`${inventory.stockGrams} - ${grams}`, updatedAt: new Date() })
            .where(and(eq(inventory.productId, productId), gte(inventory.stockGrams, grams)))
            .returning({ id: inventory.productId });
          if (!res.length) {
            const name = quote.lines.find((l) => l.productId === productId)?.name ?? "An item";
            throw new AppError(`${name} just went out of stock. Please update your cart.`, 409);
          }
        }
        const [o] = await tx
          .insert(orders)
          .values({
            orderNumber: newOrderNumber(),
            userId: input.userId,
            status: "placed",
            paymentMethod: input.paymentMethod,
            paymentStatus: "pending",
            subtotal: quote.subtotal,
            discount: quote.discount,
            deliveryFee: quote.deliveryFee,
            tax: quote.tax,
            total: quote.total,
            couponCode: quote.couponCode,
            customerName: address.recipientName,
            customerPhone: address.phone,
            address: snapshot,
            deliveryDate: slot.date,
            slotId: slot.slotId,
            slotLabel: slot.label,
            notes: input.notes ? clean(input.notes, 300) : null,
            idempotencyKey: idem,
          })
          .returning();
        await tx.insert(orderItems).values(
          quote.lines.map((l) => ({
            orderId: o.id,
            productId: l.productId,
            name: l.name,
            imageUrl: l.imageUrl,
            grams: l.grams,
            quantity: l.quantity,
            pricePerKg: l.pricePerKg,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        );
        await tx.insert(payments).values({ orderId: o.id, provider, amount: quote.total });
        if (coupon && quote.discount > 0) {
          await tx.insert(couponRedemptions).values({ couponId: coupon.id, userId: input.userId, orderId: o.id, discount: quote.discount });
        }
        await addHistory(tx, o.id, "placed", input.paymentMethod === "cod" ? "Cash on delivery" : "Awaiting online payment", input.userId);
        return o;
      });
      await notify(
        input.userId,
        order.id,
        "order_placed",
        `Order ${order.orderNumber} placed`,
        input.paymentMethod === "cod"
          ? `We have received your order of ₹${order.total}. Pay in cash on delivery.`
          : `Your order of ₹${order.total} is reserved. Complete the payment to confirm it.`,
      );
      return order;
    } catch (e) {
      const { code, constraint } = pgCode(e);
      if (code === "23505" && constraint === "orders_number_key") continue;
      if (code === "23505" && constraint === "orders_user_idem_key") {
        const [dup] = await db.select().from(orders).where(and(eq(orders.userId, input.userId), eq(orders.idempotencyKey, idem))).limit(1);
        if (dup) return dup;
      }
      throw e;
    }
  }
  throw new AppError("Could not generate an order number. Please try again.", 500);
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export type PaymentInit =
  | { mode: "demo"; orderId: string; orderNumber: string; amount: number }
  | {
      mode: "test" | "live";
      orderId: string;
      orderNumber: string;
      amount: number;
      keyId: string;
      razorpayOrderId: string;
      currency: string;
      prefill: { name: string; contact: string };
    };

export async function initiatePayment(orderId: string, userId: string): Promise<PaymentInit> {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order) throw new AppError("Order not found", 404);
  if (order.paymentMethod !== "online") throw new AppError("This order is paid on delivery");
  if (order.paymentStatus === "paid") throw new AppError("This order is already paid");
  if (order.status === "cancelled") throw new AppError("This order was cancelled");
  const cfg = razorpayConfig();
  const provider = cfg.mode === "demo" ? "demo" : "razorpay";

  let [pay] = await db.select().from(payments).where(and(eq(payments.orderId, order.id), ne(payments.provider, "cod"))).orderBy(desc(payments.createdAt)).limit(1);
  if (!pay) {
    [pay] = await db.insert(payments).values({ orderId: order.id, provider, amount: order.total }).returning();
  } else if (pay.provider !== provider || pay.status === "failed") {
    // Provider mode changed, or the previous attempt failed: start a fresh payment attempt.
    [pay] = await db.insert(payments).values({ orderId: order.id, provider, amount: order.total }).returning();
  }

  if (cfg.mode === "demo") {
    await db.update(payments).set({ providerOrderId: `demo_${order.id}` }).where(eq(payments.id, pay.id));
    return { mode: "demo", orderId: order.id, orderNumber: order.orderNumber, amount: order.total };
  }
  let rzOrderId = pay.providerOrderId;
  if (!rzOrderId) {
    const rz = await createRazorpayOrder(Math.round(order.total * 100), order.orderNumber, { orderId: order.id });
    rzOrderId = rz.id;
    await db.update(payments).set({ providerOrderId: rz.id, updatedAt: new Date() }).where(eq(payments.id, pay.id));
  }
  await db.update(orders).set({ paymentStatus: "pending", updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "failed")));
  return {
    mode: cfg.mode,
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: order.total,
    keyId: cfg.keyId,
    razorpayOrderId: rzOrderId,
    currency: "INR",
    prefill: { name: order.customerName, contact: order.customerPhone },
  };
}

/** Idempotent: safe to call from both the checkout callback and the webhook. */
export async function markOrderPaid(orderId: string, info: { providerPaymentId: string; method?: string | null; verified: boolean }) {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new AppError("Order not found", 404);
    if (order.paymentStatus === "paid") return { order, already: true, late: false };
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), ne(payments.provider, "cod")))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (!pay) throw new AppError("Payment record not found", 404);
    await tx
      .update(payments)
      .set({ status: "captured", providerPaymentId: info.providerPaymentId, method: info.method ?? pay.method, signatureVerified: info.verified, updatedAt: new Date() })
      .where(eq(payments.id, pay.id));
    if (order.status === "cancelled") {
      // Money arrived after we cancelled/expired the order: refund it in full.
      await tx.update(orders).set({ paymentStatus: "paid", refundStatus: "initiated", updatedAt: new Date() }).where(eq(orders.id, orderId));
      await tx.insert(refunds).values({ orderId, paymentId: pay.id, amount: order.total, reason: "Payment received after the order was cancelled", status: "initiated" });
      return { order, already: false, late: true };
    }
    await tx
      .update(orders)
      .set({ paymentStatus: "paid", status: order.status === "placed" ? "payment_confirmed" : order.status, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    if (order.status === "placed") await addHistory(tx, orderId, "payment_confirmed", "Online payment received");
    return { order, already: false, late: false };
  });
  if (!result.already) {
    await notify(
      result.order.userId,
      orderId,
      "payment_success",
      result.late ? `Refund for order ${result.order.orderNumber}` : `Payment received for ${result.order.orderNumber}`,
      result.late
        ? "Your order had expired, so your payment will be refunded to your original payment method."
        : `We received ₹${result.order.total}. Your order is confirmed.`,
    );
  }
  return result;
}

export async function markPaymentFailed(orderId: string, reason?: string | null) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order || order.paymentStatus === "paid") return;
    await tx
      .update(payments)
      .set({ status: "failed", failureReason: reason ? clean(reason, 200) : null, updatedAt: new Date() })
      .where(and(eq(payments.orderId, orderId), eq(payments.status, "created"), ne(payments.provider, "cod")));
    await tx.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, orderId));
  });
}

/** Cancels online orders that were never paid, returning their reserved stock. */
export async function expireStaleOrders() {
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.paymentTimeoutMinutes * 60_000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.paymentMethod, "online"), eq(orders.status, "placed"), ne(orders.paymentStatus, "paid"), lt(orders.createdAt, cutoff)))
    .limit(50);
  for (const o of stale) {
    try {
      await cancelOrder(o.id, { id: null, role: "system" }, "Payment not completed in time");
    } catch (e) {
      console.error("expire failed", e);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Cancel & refunds                                                    */
/* ------------------------------------------------------------------ */

export type Actor = { id: string | null; role: "customer" | "admin" | "delivery" | "system" };

export async function cancelOrder(orderId: string, actor: Actor, reason: string) {
  const cleanReason = clean(reason, 200) || "Cancelled";
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new AppError("Order not found", 404);
    if (actor.role === "customer" && order.userId !== actor.id) throw new AppError("Order not found", 404);
    if (order.status === "cancelled") throw new AppError("This order is already cancelled");
    if (order.status === "delivered") throw new AppError("Delivered orders cannot be cancelled");
    if (actor.role === "customer" && !CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new AppError("This order is already being prepared. Please contact support to cancel it.");
    }
    if (actor.role === "delivery") throw new AppError("Not allowed", 403);

    // Return reserved stock.
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const back = new Map<string, number>();
    for (const i of items) if (i.productId) back.set(i.productId, (back.get(i.productId) ?? 0) + i.grams * i.quantity);
    for (const [productId, grams] of back) {
      await tx
        .update(inventory)
        .set({ stockGrams: sql`${inventory.stockGrams} + ${grams}`, updatedAt: new Date() })
        .where(eq(inventory.productId, productId));
    }
    await tx.delete(couponRedemptions).where(eq(couponRedemptions.orderId, orderId));
    await tx
      .update(deliveryAssignments)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(eq(deliveryAssignments.orderId, orderId), inArray(deliveryAssignments.status, ["assigned", "accepted", "out_for_delivery"])));

    let refundStatus = order.refundStatus;
    if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
      const [pay] = await tx.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.status, "captured"))).limit(1);
      await tx.insert(refunds).values({ orderId, paymentId: pay?.id ?? null, amount: order.total, reason: cleanReason, status: "initiated", createdBy: actor.id });
      refundStatus = "initiated";
    }
    await tx
      .update(orders)
      .set({
        status: "cancelled",
        refundStatus,
        paymentStatus: order.paymentStatus === "paid" ? "paid" : "failed",
        cancelReason: cleanReason,
        cancelledBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await addHistory(tx, orderId, "cancelled", cleanReason, actor.id);
    return { order, refundStatus };
  });
  await notify(
    result.order.userId,
    orderId,
    "order_cancelled",
    `Order ${result.order.orderNumber} cancelled`,
    result.refundStatus === "initiated"
      ? `Your order was cancelled (${cleanReason}). A refund of ₹${result.order.total} has been initiated.`
      : `Your order was cancelled (${cleanReason}).`,
  );
}

async function syncRefundState(ex: Executor, orderId: string) {
  const rows = await ex.select().from(refunds).where(eq(refunds.orderId, orderId));
  const [order] = await ex.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const live = rows.filter((r) => r.status !== "failed");
  const refunded = live.filter((r) => r.status === "processed").reduce((a, r) => a + r.amount, 0);
  const pending = live.some((r) => r.status === "initiated");
  await ex
    .update(orders)
    .set({
      refundStatus: pending ? "initiated" : live.length ? "completed" : "none",
      paymentStatus: refunded >= order.total ? "refunded" : order.paymentStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

export async function initiateRefund(orderId: string, amount: number, reason: string, adminId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new AppError("Order not found", 404);
  if (order.paymentMethod !== "online" || order.paymentStatus !== "paid") throw new AppError("Only paid online orders can be refunded");
  const existing = await db.select().from(refunds).where(and(eq(refunds.orderId, orderId), ne(refunds.status, "failed")));
  const already = existing.reduce((a, r) => a + r.amount, 0);
  const max = order.total - already;
  if (!(amount > 0) || amount > max) throw new AppError(`Refund must be between ₹1 and ₹${max}`);
  const [pay] = await db.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.status, "captured"))).limit(1);
  const [r] = await db
    .insert(refunds)
    .values({ orderId, paymentId: pay?.id ?? null, amount, reason: clean(reason, 200) || "Refund", status: "initiated", createdBy: adminId })
    .returning();
  await syncRefundState(db, orderId);
  return r;
}

export async function processRefund(refundId: string) {
  const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
  if (!refund) throw new AppError("Refund not found", 404);
  if (refund.status !== "initiated") throw new AppError("This refund is already settled");
  if (refund.providerRefundId) throw new AppError("This refund was already submitted to the gateway and is awaiting confirmation");
  const [pay] = refund.paymentId ? await db.select().from(payments).where(eq(payments.id, refund.paymentId)).limit(1) : [];
  let providerRefundId: string | null = null;
  let settled = true;
  if (pay?.provider === "razorpay") {
    if (!pay.providerPaymentId) throw new AppError("Payment id missing for this refund");
    const r = await refundRazorpayPayment(pay.providerPaymentId, Math.round(refund.amount * 100), refund.id.slice(0, 40));
    providerRefundId = r.id;
    settled = r.status === "processed";
  }
  await db
    .update(refunds)
    .set({ providerRefundId, status: settled ? "processed" : "initiated", processedAt: settled ? new Date() : null })
    .where(eq(refunds.id, refundId));
  await syncRefundState(db, refund.orderId);
  const [order] = await db.select().from(orders).where(eq(orders.id, refund.orderId)).limit(1);
  if (order) {
    await notify(
      order.userId,
      order.id,
      "refund_update",
      `Refund update for ${order.orderNumber}`,
      settled ? `₹${refund.amount} has been refunded. It can take 5–7 working days to appear in your account.` : `Your refund of ₹${refund.amount} is being processed by the bank.`,
    );
  }
}

/** Called by the webhook when the gateway confirms a refund. */
export async function markRefundProcessedByProviderId(providerRefundId: string) {
  const [r] = await db.select().from(refunds).where(eq(refunds.providerRefundId, providerRefundId)).limit(1);
  if (!r || r.status === "processed") return;
  await db.update(refunds).set({ status: "processed", processedAt: new Date() }).where(eq(refunds.id, r.id));
  await syncRefundState(db, r.orderId);
  const [order] = await db.select().from(orders).where(eq(orders.id, r.orderId)).limit(1);
  if (order) await notify(order.userId, order.id, "refund_update", `Refund completed for ${order.orderNumber}`, `₹${r.amount} has been refunded to your original payment method.`);
}

/* ------------------------------------------------------------------ */
/* Status updates & assignment                                         */
/* ------------------------------------------------------------------ */

const STATUS_MESSAGES: Record<string, [string, string, string]> = {
  accepted: ["order_accepted", "Order accepted", "We have accepted your order and will start preparing it."],
  preparing: ["order_status", "Preparing your order", "Your chicken is being freshly cut and packed."],
  ready_for_dispatch: ["order_status", "Ready for dispatch", "Your order is packed and waiting for our delivery partner."],
  out_for_delivery: ["order_dispatched", "Out for delivery", "Your order is on its way."],
  delivered: ["order_delivered", "Delivered", "Your order has been delivered. Enjoy your meal!"],
};

export async function updateOrderStatus(orderId: string, to: string, actor: Actor, note?: string | null) {
  if (to === "cancelled") return cancelOrder(orderId, actor, note || "Cancelled by shop");
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new AppError("Order not found", 404);
    if (!TRANSITIONS[order.status]?.includes(to)) {
      throw new AppError(`Cannot move an order from "${STATUS_LABEL[order.status]}" to "${STATUS_LABEL[to] ?? to}"`);
    }
    if (order.paymentMethod === "online" && order.paymentStatus !== "paid") throw new AppError("Online payment is not confirmed yet");
    const [assignment] = await tx
      .select()
      .from(deliveryAssignments)
      .where(and(eq(deliveryAssignments.orderId, orderId), inArray(deliveryAssignments.status, ["assigned", "accepted", "out_for_delivery"])))
      .limit(1);
    if (actor.role === "delivery" && assignment?.staffId !== actor.id) throw new AppError("This delivery is not assigned to you", 403);
    if ((to === "out_for_delivery" || to === "delivered") && !assignment) throw new AppError("Assign a delivery partner first");

    const now = new Date();
    await tx
      .update(orders)
      .set({ status: to, deliveredAt: to === "delivered" ? now : order.deliveredAt, updatedAt: now })
      .where(eq(orders.id, orderId));
    if (to === "delivered" && order.paymentMethod === "cod") {
      await tx.update(orders).set({ paymentStatus: "paid" }).where(eq(orders.id, orderId));
      await tx
        .update(payments)
        .set({ status: "captured", method: "cash", updatedAt: now })
        .where(and(eq(payments.orderId, orderId), eq(payments.provider, "cod")));
    }
    if (assignment) {
      if (to === "out_for_delivery") {
        await tx.update(deliveryAssignments).set({ status: "out_for_delivery", acceptedAt: assignment.acceptedAt ?? now }).where(eq(deliveryAssignments.id, assignment.id));
        await tx.insert(deliveryStatusHistory).values({ orderId, assignmentId: assignment.id, status: "out_for_delivery", actorId: actor.id });
      }
      if (to === "delivered") {
        await tx.update(deliveryAssignments).set({ status: "delivered", completedAt: now }).where(eq(deliveryAssignments.id, assignment.id));
        await tx.insert(deliveryStatusHistory).values({ orderId, assignmentId: assignment.id, status: "delivered", note, actorId: actor.id });
      }
    }
    await addHistory(tx, orderId, to, note, actor.id);
    return order;
  });
  const m = STATUS_MESSAGES[to];
  if (m) await notify(result.userId, orderId, m[0], `${m[1]} · ${result.orderNumber}`, m[2]);
}

export async function assignDelivery(orderId: string, staffId: string, adminId: string) {
  const [staff] = await db.execute<{ id: string; name: string }>(
    sql`select id, name from profiles where id = ${staffId} and role = 'delivery' and is_active = true`,
  ).then((r) => r.rows);
  if (!staff) throw new AppError("Delivery partner not found or inactive");
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new AppError("Order not found", 404);
    if (!["accepted", "preparing", "ready_for_dispatch"].includes(order.status)) {
      throw new AppError("Accept the order before assigning delivery (and assign before it leaves the shop)");
    }
    await tx
      .update(deliveryAssignments)
      .set({ status: "reassigned", completedAt: new Date() })
      .where(and(eq(deliveryAssignments.orderId, orderId), inArray(deliveryAssignments.status, ["assigned", "accepted", "out_for_delivery"])));
    const [a] = await tx.insert(deliveryAssignments).values({ orderId, staffId, assignedBy: adminId }).returning();
    await tx.insert(deliveryStatusHistory).values({ orderId, assignmentId: a.id, status: "assigned", note: `Assigned to ${staff.name}`, actorId: adminId });
  });
  const [o] = await db.select({ n: orders.orderNumber }).from(orders).where(eq(orders.id, orderId)).limit(1);
  await notify(staffId, orderId, "delivery_assigned", `New delivery ${o?.n ?? ""}`, "A new order has been assigned to you.");
}
