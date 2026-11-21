import { handler, json, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { cancelOrder } from "@/lib/orders";
import { requireApi } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireApi(["customer"]);
  const { id } = await params;
  if (!isUuid(id)) throw new AppError("Order not found", 404);
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  await cancelOrder(id, { id: user.id, role: "customer" }, typeof body.reason === "string" && body.reason ? body.reason : "Cancelled by customer");
  return json({ ok: true });
});
