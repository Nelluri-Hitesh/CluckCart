import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deliveryAssignments, deliveryStatusHistory, orders } from "@/db/schema";
import { AppError } from "./errors";
import { notify } from "./notify";
import { updateOrderStatus } from "./orders";
import { clean } from "./validation";

const ACTIVE = ["assigned", "accepted", "out_for_delivery"];

async function ownAssignment(assignmentId: string, staffId: string) {
  const [a] = await db
    .select()
    .from(deliveryAssignments)
    .where(and(eq(deliveryAssignments.id, assignmentId), eq(deliveryAssignments.staffId, staffId)))
    .limit(1);
  // Same message for "missing" and "someone else's" so staff cannot probe other deliveries.
  if (!a) throw new AppError("Delivery not found", 404);
  if (!ACTIVE.includes(a.status)) throw new AppError("This delivery is no longer active");
  return a;
}

export async function acceptAssignment(assignmentId: string, staffId: string) {
  const a = await ownAssignment(assignmentId, staffId);
  if (a.status !== "assigned") throw new AppError("Already acknowledged");
  await db.update(deliveryAssignments).set({ status: "accepted", acceptedAt: new Date() }).where(eq(deliveryAssignments.id, a.id));
  await db.insert(deliveryStatusHistory).values({ orderId: a.orderId, assignmentId: a.id, status: "accepted", actorId: staffId });
}

export async function startDelivery(assignmentId: string, staffId: string) {
  const a = await ownAssignment(assignmentId, staffId);
  await updateOrderStatus(a.orderId, "out_for_delivery", { id: staffId, role: "delivery" }, "Picked up by delivery partner");
}

export async function completeDelivery(assignmentId: string, staffId: string) {
  const a = await ownAssignment(assignmentId, staffId);
  await updateOrderStatus(a.orderId, "delivered", { id: staffId, role: "delivery" }, "Delivered to customer");
}

export async function failDelivery(assignmentId: string, staffId: string, reason: string) {
  const a = await ownAssignment(assignmentId, staffId);
  const why = clean(reason, 200);
  if (!why) throw new AppError("Please enter a reason");
  const order = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, a.orderId)).for("update");
    if (!o) throw new AppError("Order not found", 404);
    await tx
      .update(deliveryAssignments)
      .set({ status: "failed", failureReason: why, completedAt: new Date() })
      .where(and(eq(deliveryAssignments.id, a.id), inArray(deliveryAssignments.status, ACTIVE)));
    if (o.status === "out_for_delivery") {
      await tx.update(orders).set({ status: "ready_for_dispatch", updatedAt: new Date() }).where(eq(orders.id, o.id));
    }
    await tx.insert(deliveryStatusHistory).values({ orderId: o.id, assignmentId: a.id, status: "failed", note: why, actorId: staffId });
    return o;
  });
  await notify(order.userId, order.id, "delivery_failed", `Delivery attempt unsuccessful · ${order.orderNumber}`, `We could not deliver your order (${why}). We will contact you to reschedule.`);
}
