import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  categories,
  customerAddresses,
  deliveryAssignments,
  deliveryStaff,
  inventory,
  orderStatusHistory,
  orders,
  payments,
  productVariants,
  products,
  profiles,
  refunds,
} from "../src/db/schema";
import { runSeed } from "../src/db/seed";
import { acceptAssignment, completeDelivery, failDelivery, startDelivery } from "../src/lib/delivery";
import { AppError } from "../src/lib/errors";
import {
  assignDelivery,
  buildQuote,
  cancelOrder,
  createOrder,
  initiatePayment,
  initiateRefund,
  markOrderPaid,
  processRefund,
  updateOrderStatus,
} from "../src/lib/orders";
import { getOrderDetail } from "../src/lib/order-queries";
import { hashPassword } from "../src/lib/password";
import { getSettings } from "../src/lib/settings";
import { getAvailableSlots } from "../src/lib/slots";

const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
let productId = "";
let userId = "";
let otherUserId = "";
let staffA = "";
let staffB = "";
let adminId = "";
let addressId = "";
let badAddressId = "";
let slotKey = "";
const createdUsers: string[] = [];

async function stock() {
  const [r] = await db.select().from(inventory).where(eq(inventory.productId, productId));
  return r.stockGrams;
}
const items = (grams: number, quantity = 1) => [{ productId, grams, quantity }];
const place = (o: Partial<Parameters<typeof createOrder>[0]> & { grams?: number; qty?: number } = {}) =>
  createOrder({
    userId,
    items: items(o.grams ?? 500, o.qty ?? 1),
    addressId,
    slotKey,
    paymentMethod: "cod",
    idempotencyKey: randomUUID(),
    ...o,
  });
const rejects = (p: Promise<unknown>, status?: number) =>
  assert.rejects(p, (e: unknown) => e instanceof AppError && (status ? e.status === status : true));

async function mkUser(role: "customer" | "delivery" | "admin", name: string) {
  const [u] = await db.insert(profiles).values({ name, phone: `9${rnd().slice(1, 9)}${role[0] === "c" ? "1" : "2"}`.slice(0, 10), passwordHash: await hashPassword("Test12345"), role }).returning();
  createdUsers.push(u.id);
  return u.id;
}

before(async () => {
  await runSeed();
  const [cat] = await db.select().from(categories).limit(1);
  const [p] = await db
    .insert(products)
    .values({ categoryId: cat.id, name: `TEST chicken ${rnd()}`, slug: `test-${rnd()}`, pricePerKg: 200, mrpPerKg: 250, description: "test" })
    .returning();
  productId = p.id;
  await db.insert(productVariants).values([{ productId, grams: 500, label: "500 g" }, { productId, grams: 1000, label: "1 kg" }]);
  await db.insert(inventory).values({ productId, stockGrams: 3000, lowStockGrams: 500 });
  userId = await mkUser("customer", "Test Customer");
  otherUserId = await mkUser("customer", "Other Customer");
  staffA = await mkUser("delivery", "Rider A");
  staffB = await mkUser("delivery", "Rider B");
  await db.insert(deliveryStaff).values([{ profileId: staffA, employeeCode: `T-${rnd()}` }, { profileId: staffB, employeeCode: `T-${rnd()}` }]);
  [{ id: adminId }] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, "admin")).limit(1);
  const base = { userId, recipientName: "Test Customer", phone: "9876543210", line1: "Flat 1, Test Street", city: "Hyderabad", state: "Telangana" };
  [{ id: addressId }] = await db.insert(customerAddresses).values({ ...base, pincode: "500081" }).returning();
  [{ id: badAddressId }] = await db.insert(customerAddresses).values({ ...base, pincode: "110001" }).returning();
  const slots = await getAvailableSlots();
  slotKey = slots.find((s) => s.remaining > 0)!.key;
  assert.ok(slotKey, "a delivery slot must be available for tests");
});

after(async () => {
  await db.delete(orders).where(inArray(orders.userId, [userId, otherUserId]));
  await db.delete(profiles).where(inArray(profiles.id, createdUsers));
  await db.delete(products).where(eq(products.id, productId));
  await pool.end();
});

test("quote: server prices the cart, applies coupon and delivery fee", async () => {
  const s = await getSettings();
  const q = await buildQuote({ items: [{ productId, grams: 1000, quantity: 1 }, { productId, grams: 500, quantity: 2 }], userId });
  assert.equal(q.subtotal, 400);
  assert.equal(q.total, 400 + (400 >= s.freeDeliveryAbove ? 0 : s.deliveryFee));
  const withCoupon = await buildQuote({ items: items(1000, 2), couponCode: "first50", userId });
  assert.equal(withCoupon.discount, 50);
  assert.equal(withCoupon.couponCode, "FIRST50");
  const bad = await buildQuote({ items: items(1000, 2), couponCode: "NOPE", userId });
  assert.equal(bad.discount, 0);
  assert.ok(bad.couponError);
});

test("quote: rejects tampered weights and unknown items", async () => {
  await rejects(buildQuote({ items: items(777, 1), userId }));
  await rejects(buildQuote({ items: [{ productId: randomUUID(), grams: 500, quantity: 1 }], userId }));
  await rejects(buildQuote({ items: items(500, 0), userId }));
});

test("order creation reserves stock and records a COD payment", async () => {
  const before = await stock();
  const o = await place({ grams: 1000 });
  assert.equal(o.status, "placed");
  assert.match(o.orderNumber, /^CM\d{6}-[A-Z0-9]{5}$/);
  assert.equal(await stock(), before - 1000);
  const [p] = await db.select().from(payments).where(eq(payments.orderId, o.id));
  assert.equal(p.provider, "cod");
  await cancelOrder(o.id, { id: userId, role: "customer" }, "test");
  assert.equal(await stock(), before);
});

test("duplicate submissions with the same idempotency key create one order", async () => {
  const before = await stock();
  const key = randomUUID();
  const a = await place({ idempotencyKey: key, grams: 1000 });
  const b = await place({ idempotencyKey: key, grams: 1000 });
  assert.equal(a.id, b.id);
  assert.equal(await stock(), before - 1000);
  await cancelOrder(a.id, { id: userId, role: "customer" }, "test");
});

test("inventory: cannot oversell, even with concurrent orders", async () => {
  const start = await stock();
  assert.equal(start, 3000);
  await rejects(place({ grams: 1000, qty: 4 }), 409);
  assert.equal(await stock(), start);
  const results = await Promise.allSettled([place({ grams: 1000, qty: 2 }), place({ grams: 1000, qty: 2 })]);
  const ok = results.filter((r) => r.status === "fulfilled");
  assert.equal(ok.length, 1, "exactly one of two competing orders may succeed");
  assert.equal(await stock(), start - 2000);
  for (const r of ok) await cancelOrder((r as PromiseFulfilledResult<{ id: string }>).value.id, { id: userId, role: "customer" }, "test");
  assert.equal(await stock(), start);
});

test("checkout rules: minimum order, service area, COD limit", async () => {
  await rejects(createOrder({ userId, items: items(500, 0 + 1).map((i) => ({ ...i, grams: 500 })), addressId, slotKey, paymentMethod: "cod", idempotencyKey: randomUUID(), couponCode: null }).then(async (o) => {
    // 500g = ₹100 which is below the ₹199 minimum, so this must not succeed
    await cancelOrder(o.id, { id: userId, role: "customer" }, "cleanup");
  }), 400);
  await rejects(place({ addressId: badAddressId, grams: 1000, qty: 2 }), 400);
  await rejects(place({ addressId: randomUUID(), grams: 1000, qty: 2 }));
  await rejects(place({ slotKey: "2000-01-01|" + randomUUID(), grams: 1000, qty: 2 }), 409);
  await rejects(place({ paymentMethod: "bitcoin", grams: 1000, qty: 2 }));
});

test("online payment: confirmation is idempotent and unlocks the order", async () => {
  const o = await place({ grams: 1000, qty: 2, paymentMethod: "online" });
  assert.equal(o.paymentStatus, "pending");
  const init = await initiatePayment(o.id, userId);
  assert.equal(init.mode, "demo");
  await rejects(initiatePayment(o.id, otherUserId), 404);
  await rejects(updateOrderStatus(o.id, "accepted", { id: adminId, role: "admin" }));
  const first = await markOrderPaid(o.id, { providerPaymentId: `pay_${rnd()}`, verified: true });
  const second = await markOrderPaid(o.id, { providerPaymentId: `pay_${rnd()}`, verified: true });
  assert.equal(first.already, false);
  assert.equal(second.already, true);
  const [after] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(after.paymentStatus, "paid");
  assert.equal(after.status, "payment_confirmed");
  const hist = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, o.id));
  assert.equal(hist.filter((h) => h.status === "payment_confirmed").length, 1);
  await cancelOrder(o.id, { id: adminId, role: "admin" }, "test cleanup");
});

test("cancelling a paid online order queues a refund, restores stock and settles", async () => {
  const before = await stock();
  const o = await place({ grams: 1000, qty: 2, paymentMethod: "online" });
  await initiatePayment(o.id, userId);
  await markOrderPaid(o.id, { providerPaymentId: `pay_${rnd()}`, verified: true });
  await cancelOrder(o.id, { id: userId, role: "customer" }, "changed my mind");
  assert.equal(await stock(), before);
  const [r] = await db.select().from(refunds).where(eq(refunds.orderId, o.id));
  assert.equal(r.status, "initiated");
  assert.equal(r.amount, o.total);
  let [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.refundStatus, "initiated");
  await processRefund(r.id);
  [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.refundStatus, "completed");
  assert.equal(row.paymentStatus, "refunded");
  await rejects(processRefund(r.id)); // cannot be refunded twice
});

test("late payment on an already-cancelled order is refunded automatically", async () => {
  const o = await place({ grams: 1000, qty: 2, paymentMethod: "online" });
  await initiatePayment(o.id, userId);
  await cancelOrder(o.id, { id: null, role: "system" }, "Payment not completed in time");
  const res = await markOrderPaid(o.id, { providerPaymentId: `pay_${rnd()}`, verified: true });
  assert.equal(res.late, true);
  const refundRows = await db.select().from(refunds).where(eq(refunds.orderId, o.id));
  assert.equal(refundRows.length, 1);
  assert.equal(refundRows[0].status, "initiated");
});

test("partial refunds cannot exceed the order total", async () => {
  const o = await place({ grams: 1000, qty: 2, paymentMethod: "online" });
  await initiatePayment(o.id, userId);
  await markOrderPaid(o.id, { providerPaymentId: `pay_${rnd()}`, verified: true });
  const r1 = await initiateRefund(o.id, 100, "quality", adminId);
  await processRefund(r1.id);
  await rejects(initiateRefund(o.id, o.total, "too much", adminId));
  await rejects(initiateRefund(o.id, 0, "zero", adminId));
  await cancelOrder(o.id, { id: adminId, role: "admin" }, "cleanup");
});

test("order lifecycle with delivery assignment, failed attempt and COD collection", async () => {
  const o = await place({ grams: 1000, qty: 2 });
  await rejects(updateOrderStatus(o.id, "delivered", { id: adminId, role: "admin" })); // cannot skip steps
  await rejects(assignDelivery(o.id, staffA, adminId)); // must be accepted first
  await updateOrderStatus(o.id, "accepted", { id: adminId, role: "admin" });
  await assignDelivery(o.id, staffA, adminId);
  const [a1] = await db.select().from(deliveryAssignments).where(eq(deliveryAssignments.orderId, o.id));
  await rejects(acceptAssignment(a1.id, staffB), 404); // another rider cannot touch it
  await acceptAssignment(a1.id, staffA);
  await rejects(startDelivery(a1.id, staffA)); // not ready for dispatch yet
  await updateOrderStatus(o.id, "preparing", { id: adminId, role: "admin" });
  await updateOrderStatus(o.id, "ready_for_dispatch", { id: adminId, role: "admin" });
  await startDelivery(a1.id, staffA);
  let [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.status, "out_for_delivery");
  await failDelivery(a1.id, staffA, "Customer not reachable");
  [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.status, "ready_for_dispatch");
  await assignDelivery(o.id, staffB, adminId);
  const active = (await db.select().from(deliveryAssignments).where(eq(deliveryAssignments.orderId, o.id))).find((a) => a.status === "assigned")!;
  await rejects(completeDelivery(active.id, staffA), 404);
  await acceptAssignment(active.id, staffB);
  await startDelivery(active.id, staffB);
  await completeDelivery(active.id, staffB);
  [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.status, "delivered");
  assert.equal(row.paymentStatus, "paid", "COD is marked paid when delivered");
  await rejects(cancelOrder(o.id, { id: adminId, role: "admin" }, "too late"));
});

test("customers cannot cancel once preparing, or read each other's orders", async () => {
  const o = await place({ grams: 1000, qty: 1 });
  assert.ok(await getOrderDetail(o.id, userId));
  assert.equal(await getOrderDetail(o.id, otherUserId), null);
  await rejects(cancelOrder(o.id, { id: otherUserId, role: "customer" }, "not mine"), 404);
  await updateOrderStatus(o.id, "accepted", { id: adminId, role: "admin" });
  await updateOrderStatus(o.id, "preparing", { id: adminId, role: "admin" });
  await rejects(cancelOrder(o.id, { id: userId, role: "customer" }, "late"));
  await cancelOrder(o.id, { id: adminId, role: "admin" }, "admin override");
});

test("database constraints reject invalid data", async () => {
  await assert.rejects(db.insert(profiles).values({ name: "x", phone: "9000000999", passwordHash: "x", role: "superadmin" }));
  await assert.rejects(db.update(inventory).set({ stockGrams: -1 }).where(eq(inventory.productId, productId)));
});
