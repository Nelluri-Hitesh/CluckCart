import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { handler, json } from "@/lib/api";
import { isPincode } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const pincode = new URL(req.url).searchParams.get("pincode") ?? "";
  if (!isPincode(pincode)) throw new AppError("Enter a valid 6-digit PIN code");
  const [zone] = await db.select().from(deliveryZones).where(and(eq(deliveryZones.pincode, pincode), eq(deliveryZones.isActive, true))).limit(1);
  return json({ serviceable: !!zone, area: zone?.areaName ?? null });
});
