import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { handler, json, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireApi } from "@/lib/session";
import { clean, normalizeEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = handler(async (req) => {
  const user = await requireApi();
  const body = await readJson(req);
  const name = clean(body.name, 80);
  const emailRaw = clean(body.email, 120);
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (name.length < 2) throw new AppError("Please enter your name");
  if (emailRaw && !email) throw new AppError("Enter a valid email address");
  if (email) {
    const clash = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.email, email), ne(profiles.id, user.id))).limit(1);
    if (clash.length) throw new AppError("That email is already used by another account", 409);
  }
  // Only name and email may be changed here — never role or status.
  await db.update(profiles).set({ name, email, updatedAt: new Date() }).where(eq(profiles.id, user.id));
  return json({ ok: true });
});
