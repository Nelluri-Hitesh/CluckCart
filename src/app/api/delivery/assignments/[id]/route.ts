import { acceptAssignment, completeDelivery, failDelivery, startDelivery } from "@/lib/delivery";
import { handler, json, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireApi } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Delivery staff actions on their OWN assignment: accept | start | complete | fail. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireApi(["delivery"]);
  const { id } = await params;
  if (!isUuid(id)) throw new AppError("Delivery not found", 404);
  const body = await readJson(req);
  switch (body.action) {
    case "accept":
      await acceptAssignment(id, user.id);
      break;
    case "start":
      await startDelivery(id, user.id);
      break;
    case "complete":
      await completeDelivery(id, user.id);
      break;
    case "fail":
      await failDelivery(id, user.id, String(body.reason ?? ""));
      break;
    default:
      throw new AppError("Unknown action");
  }
  return json({ ok: true });
});
