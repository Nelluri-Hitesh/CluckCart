import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { handler, json, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { markOrderPaid } from "@/lib/orders";
import { razorpayConfig, verifyCheckoutSignature } from "@/lib/razorpay";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Server-side verification of the Razorpay Checkout callback. The browser result is never trusted on its own. */
export const POST = handler(async (req) => {
  const user = await requireApi(["customer"]);
  const body = await readJson(req);
  const rzOrder = String(body.razorpay_order_id ?? "");
  const rzPayment = String(body.razorpay_payment_id ?? "");
  const signature = String(body.razorpay_signature ?? "");
  const cfg = razorpayConfig();
  if (cfg.mode === "demo") throw new AppError("Online payments are running in demo mode", 400);
  if (!verifyCheckoutSignature(rzOrder, rzPayment, signature, cfg.keySecret)) throw new AppError("Payment verification failed", 400);

  const [row] = await db
    .select({ orderId: payments.orderId })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.providerOrderId, rzOrder), eq(orders.userId, user.id)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!row) throw new AppError("Order not found", 404);
  await markOrderPaid(row.orderId, { providerPaymentId: rzPayment, verified: true });
  return json({ ok: true, orderId: row.orderId });
});
