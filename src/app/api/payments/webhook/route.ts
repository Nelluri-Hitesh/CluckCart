import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, webhookEvents } from "@/db/schema";
import { handler, json } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { markOrderPaid, markPaymentFailed, markRefundProcessedByProviderId } from "@/lib/orders";
import { razorpayConfig, verifyWebhookSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

type Entity = { id: string; order_id?: string; amount?: number; method?: string; error_description?: string };

export const POST = handler(async (req) => {
  const raw = await req.text();
  const cfg = razorpayConfig();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "", cfg.webhookSecret)) {
    throw new AppError("Invalid signature", 400);
  }
  const event = JSON.parse(raw) as { event: string; payload: Record<string, { entity: Entity }> };
  const eventId = req.headers.get("x-razorpay-event-id") || createHash("sha256").update(raw).digest("hex");

  // Idempotency: a repeated delivery of the same event is acknowledged and ignored.
  const inserted = await db.insert(webhookEvents).values({ id: eventId, type: event.event }).onConflictDoNothing().returning();
  if (!inserted.length) return json({ ok: true, duplicate: true });

  try {
    const payment = event.payload?.payment?.entity;
    if ((event.event === "payment.captured" || event.event === "order.paid") && payment?.order_id) {
      const [row] = await db.select().from(payments).where(eq(payments.providerOrderId, payment.order_id)).orderBy(desc(payments.createdAt)).limit(1);
      if (row) {
        if (payment.amount !== Math.round(row.amount * 100)) {
          console.error("Webhook amount mismatch", payment.id, payment.amount, row.amount);
        } else {
          await markOrderPaid(row.orderId, { providerPaymentId: payment.id, method: payment.method, verified: true });
        }
      }
    } else if (event.event === "payment.failed" && payment?.order_id) {
      const [row] = await db.select().from(payments).where(eq(payments.providerOrderId, payment.order_id)).orderBy(desc(payments.createdAt)).limit(1);
      if (row) await markPaymentFailed(row.orderId, payment.error_description);
    } else if (event.event === "refund.processed") {
      const refund = event.payload?.refund?.entity;
      if (refund?.id) await markRefundProcessedByProviderId(refund.id);
    }
  } catch (e) {
    // Let Razorpay retry: forget that we saw this event.
    await db.delete(webhookEvents).where(eq(webhookEvents.id, eventId));
    throw e;
  }
  return json({ ok: true });
});
