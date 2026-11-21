import { handler, json, readJson } from "@/lib/api";
import { buildQuote } from "@/lib/orders";
import { getCurrentUser } from "@/lib/session";
import { isPincode } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const body = await readJson(req);
  const user = await getCurrentUser();
  const quote = await buildQuote({
    items: body.items,
    couponCode: typeof body.couponCode === "string" && body.couponCode.trim() ? body.couponCode : null,
    pincode: isPincode(body.pincode) ? body.pincode : null,
    userId: user?.id ?? null,
  });
  return json({ quote });
});
