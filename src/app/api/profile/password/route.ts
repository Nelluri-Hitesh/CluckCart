import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions } from "@/db/schema";
import { clientIp, handler, json, rateLimit, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, requireApi } from "@/lib/session";
import { passwordProblem } from "@/lib/validation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const user = await requireApi();
  rateLimit(`pw:${user.id}:${clientIp(req)}`, 8, 15 * 60_000);
  const body = await readJson(req);
  const problem = passwordProblem(body.newPassword);
  if (problem) throw new AppError(problem);
  const [row] = await db.select({ hash: profiles.passwordHash }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (!row || typeof body.currentPassword !== "string" || !(await verifyPassword(body.currentPassword, row.hash))) {
    throw new AppError("Your current password is incorrect", 400);
  }
  await db.update(profiles).set({ passwordHash: await hashPassword(body.newPassword as string), updatedAt: new Date() }).where(eq(profiles.id, user.id));
  // Sign out every other device.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.delete(sessions).where(token ? and(eq(sessions.userId, user.id), ne(sessions.tokenHash, hashToken(token))) : eq(sessions.userId, user.id));
  return json({ ok: true });
});
