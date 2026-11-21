import { handler, json } from "@/lib/api";
import { getAvailableSlots } from "@/lib/slots";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json({ slots: await getAvailableSlots() }));
