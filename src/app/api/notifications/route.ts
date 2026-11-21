import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { handler, json } from "@/lib/api";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireApi();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
  return json({ notifications: rows });
});

/** Marks all of the caller's notifications as read. */
export const POST = handler(async () => {
  const user = await requireApi();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return json({ ok: true });
});
