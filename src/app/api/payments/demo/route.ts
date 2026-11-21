import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { handler, json, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { markOrderPaid, markPaymentFailed } from "@/lib/orders";
import { razorpayConfig } from "@/lib/razorpay";
import { requireApi } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Simulated gateway used ONLY while no Razorpay keys are configured (development / demo).
 * As soon as RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set this endpoint refuses to work.
 */
export const POST = handler(async (req) => {
  const user = await requireApi(["customer"]);
  if (razorpayConfig().mode !== "demo") throw new AppError("Not available", 404);
  const body = await readJson(req);
  if (!isUuid(body.orderId)) throw new AppError("Order not found", 404);
  const [order] = await db.select().from(orders).where(and(eq(orders.id, body.orderId), eq(orders.userId, user.id))).limit(1);
  if (!order || order.paymentMethod !== "online") throw new AppError("Order not found", 404);
  if (body.outcome === "failure") {
    await markPaymentFailed(order.id, "Simulated failure");
    return json({ ok: false });
  }
  await markOrderPaid(order.id, { providerPaymentId: `demo_pay_${randomBytes(8).toString("hex")}`, method: "demo", verified: false });
  return json({ ok: true });
});
