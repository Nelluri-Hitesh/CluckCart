import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses } from "@/db/schema";
import { parseAddress } from "@/lib/addresses";
import { handler, json, readJson } from "@/lib/api";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireApi();
  const rows = await db.select().from(customerAddresses).where(eq(customerAddresses.userId, user.id)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
  return json({ addresses: rows });
});

export const POST = handler(async (req) => {
  const user = await requireApi();
  const data = parseAddress(await readJson(req));
  const existing = await db.select({ id: customerAddresses.id }).from(customerAddresses).where(eq(customerAddresses.userId, user.id));
  if (existing.length >= 10) return json({ error: "You can save up to 10 addresses" }, 400);
  const makeDefault = existing.length === 0;
  const [row] = await db.insert(customerAddresses).values({ ...data, userId: user.id, isDefault: makeDefault }).returning();
  return json({ address: row }, 201);
});
