import { handler, json } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getOrderDetail } from "@/lib/order-queries";
import { requireApi } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireApi(["customer"]);
  const { id } = await params;
  const detail = isUuid(id) ? await getOrderDetail(id, user.id) : null;
  if (!detail) throw new AppError("Order not found", 404);
  return json(detail);
});
