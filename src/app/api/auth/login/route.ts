import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { clientIp, handler, json, rateLimit, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, roleHome, setSessionCookie, type Role } from "@/lib/session";
import { clean, normalizeEmail, normalizePhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

let dummyHash: Promise<string> | null = null;

export const POST = handler(async (req) => {
  const body = await readJson(req);
  const identifier = clean(body.identifier, 120).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) throw new AppError("Enter your phone/email and password");
  rateLimit(`login:${clientIp(req)}:${identifier}`, 8, 15 * 60_000);
  rateLimit(`login-ip:${clientIp(req)}`, 40, 15 * 60_000);

  const phone = normalizePhone(identifier);
  const email = identifier.includes("@") ? normalizeEmail(identifier) : null;
  const [user] =
    phone || email
      ? await db.select().from(profiles).where(phone ? eq(profiles.phone, phone) : eq(profiles.email, email!)).limit(1)
      : [];
  // Always run a hash comparison so response time does not reveal whether the account exists.
  dummyHash ??= hashPassword("not-a-real-password-1");
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await dummyHash), false);
  if (!user || !ok) throw new AppError("Incorrect phone/email or password", 401);
  if (!user.isActive) throw new AppError("This account has been deactivated. Please contact support.", 403);

  const token = await createSession(user.id, req.headers.get("user-agent"));
  await setSessionCookie(token);
  return json({
    user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
    token,
    home: roleHome(user.role as Role),
  });
});
