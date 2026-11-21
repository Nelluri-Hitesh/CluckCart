import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliverySlots, orders } from "@/db/schema";
import { addDays, istNow } from "./format";
import { getSettings } from "./settings";

export type SlotOption = {
  key: string;
  date: string;
  slotId: string;
  label: string;
  dayLabel: string;
  remaining: number;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Slots for today (if still bookable) and tomorrow, with remaining capacity. */
export async function getAvailableSlots(): Promise<SlotOption[]> {
  const settings = await getSettings();
  const slots = await db.select().from(deliverySlots).where(eq(deliverySlots.isActive, true)).orderBy(deliverySlots.startTime);
  if (!slots.length) return [];
  const now = istNow();
  const dates = [now.date, addDays(now.date, 1)];
  const counts = await db
    .select({ date: orders.deliveryDate, slotId: orders.slotId, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(inArray(orders.deliveryDate, dates), ne(orders.status, "cancelled")))
    .groupBy(orders.deliveryDate, orders.slotId);
  const used = new Map(counts.map((c) => [`${c.date}|${c.slotId}`, c.n]));
  const result: SlotOption[] = [];
  dates.forEach((date, i) => {
    for (const s of slots) {
      if (i === 0 && toMinutes(s.startTime) < now.minutes + settings.slotLeadMinutes) continue;
      const remaining = s.capacity - (used.get(`${date}|${s.id}`) ?? 0);
      result.push({
        key: `${date}|${s.id}`,
        date,
        slotId: s.id,
        label: s.label,
        dayLabel: i === 0 ? "Today" : "Tomorrow",
        remaining: Math.max(0, remaining),
      });
    }
  });
  return result;
}
