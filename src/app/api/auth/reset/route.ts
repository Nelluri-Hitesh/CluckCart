import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, profiles, sessions } from "@/db/schema";
import { clientIp, handler, json, rateLimit, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { hashPassword, hashToken } from "@/lib/password";
import { passwordProblem } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60_000);
  const body = await readJson(req);
  const pw = passwordProblem(body.password);
  if (pw) throw new AppError(pw);
  if (typeof body.token !== "string") throw new AppError("Invalid or expired link");
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hashToken(body.token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .limit(1);
  if (!row) throw new AppError("This reset link is invalid or has expired");
  const passwordHash = await hashPassword(body.password as string);
  await db.transaction(async (tx) => {
    await tx.update(profiles).set({ passwordHash, updatedAt: new Date() }).where(eq(profiles.id, row.userId));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
  });
  return json({ ok: true });
});
