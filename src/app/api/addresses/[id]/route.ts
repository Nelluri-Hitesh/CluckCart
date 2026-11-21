import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses } from "@/db/schema";
import { parseAddress } from "@/lib/addresses";
import { handler, json, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireApi } from "@/lib/session";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireApi();
  const { id } = await params;
  if (!isUuid(id)) throw new AppError("Address not found", 404);
  const body = await readJson(req);
  const data = parseAddress(body);
  const [row] = await db
    .update(customerAddresses)
    .set(data)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, user.id)))
    .returning();
  if (!row) throw new AppError("Address not found", 404);
  if (body.isDefault === true) {
    await db.update(customerAddresses).set({ isDefault: false }).where(and(eq(customerAddresses.userId, user.id), ne(customerAddresses.id, id)));
    await db.update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, id));
  }
  return json({ address: row });
});

export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireApi();
  const { id } = await params;
  if (!isUuid(id)) throw new AppError("Address not found", 404);
  const res = await db.delete(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, user.id))).returning({ id: customerAddresses.id });
  if (!res.length) throw new AppError("Address not found", 404);
  return json({ ok: true });
});
