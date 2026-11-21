import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deliveryAssignments, orderItems, orderStatusHistory, orders, payments, profiles, refunds } from "@/db/schema";

/** Order detail for its owner. Delivery partner contact is only included once the order is on the way. */
export async function getOrderDetail(orderId: string, userId: string) {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order) return null;
  const [items, history, pays, refundRows, assignment] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select({ provider: payments.provider, status: payments.status, method: payments.method, createdAt: payments.createdAt }).from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)),
    db.select({ amount: refunds.amount, status: refunds.status, createdAt: refunds.createdAt }).from(refunds).where(eq(refunds.orderId, orderId)),
    db
      .select({ name: profiles.name, phone: profiles.phone, status: deliveryAssignments.status })
      .from(deliveryAssignments)
      .innerJoin(profiles, eq(profiles.id, deliveryAssignments.staffId))
      .where(and(eq(deliveryAssignments.orderId, orderId), inArray(deliveryAssignments.status, ["assigned", "accepted", "out_for_delivery"])))
      .limit(1),
  ]);
  const rider = order.status === "out_for_delivery" && assignment[0] ? { name: assignment[0].name, phone: assignment[0].phone } : null;
  return { order, items, history, payments: pays, refunds: refundRows, rider };
}
