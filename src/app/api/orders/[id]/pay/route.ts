import { handler, json } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { initiatePayment } from "@/lib/orders";
import { requireApi } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** (Re)starts an online payment attempt for one of the caller's own unpaid orders. */
export const POST = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireApi(["customer"]);
  const { id } = await params;
  if (!isUuid(id)) throw new AppError("Order not found", 404);
  return json({ payment: await initiatePayment(id, user.id) });
});
