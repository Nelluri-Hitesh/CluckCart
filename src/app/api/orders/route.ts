import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { handler, json, rateLimit, readJson } from "@/lib/api";
import { createOrder, initiatePayment, type PaymentInit } from "@/lib/orders";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireApi(["customer"]);
  const rows = await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(100);
  return json({ orders: rows });
});

export const POST = handler(async (req) => {
  const user = await requireApi(["customer"]);
  rateLimit(`order:${user.id}`, 20, 10 * 60_000);
  const body = await readJson(req);
  const order = await createOrder({
    userId: user.id,
    items: body.items,
    addressId: String(body.addressId ?? ""),
    slotKey: String(body.slotKey ?? ""),
    paymentMethod: String(body.paymentMethod ?? ""),
    couponCode: typeof body.couponCode === "string" ? body.couponCode : null,
    idempotencyKey: String(body.idempotencyKey ?? ""),
    notes: typeof body.notes === "string" ? body.notes : null,
  });
  let payment: PaymentInit | null = null;
  let paymentError: string | null = null;
  if (order.paymentMethod === "online" && order.paymentStatus !== "paid") {
    try {
      payment = await initiatePayment(order.id, user.id);
    } catch (e) {
      // The order stays reserved; the customer can retry payment from the order page.
      paymentError = e instanceof Error ? e.message : "Could not start payment";
    }
  }
  return json({ order: { id: order.id, orderNumber: order.orderNumber, total: order.total, status: order.status }, payment, paymentError }, 201);
});
