import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { clientIp, handler, json, rateLimit, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { clean, normalizeEmail, normalizePhone, passwordProblem } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  const body = await readJson(req);
  const name = clean(body.name, 80);
  const phone = normalizePhone(body.phone);
  const emailRaw = clean(body.email, 120);
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (name.length < 2) throw new AppError("Please enter your name");
  if (!phone) throw new AppError("Enter a valid 10-digit Indian mobile number");
  if (emailRaw && !email) throw new AppError("Enter a valid email address");
  const pw = passwordProblem(body.password);
  if (pw) throw new AppError(pw);

  const clash = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(email ? or(eq(profiles.phone, phone), eq(profiles.email, email)) : eq(profiles.phone, phone))
    .limit(1);
  if (clash.length) throw new AppError("An account with this phone number or email already exists. Try logging in.", 409);

  // The role is always "customer": admin and delivery accounts can only be provisioned by an admin.
  const [user] = await db
    .insert(profiles)
    .values({ name, phone, email, passwordHash: await hashPassword(body.password as string), role: "customer" })
    .returning({ id: profiles.id, name: profiles.name, phone: profiles.phone, email: profiles.email, role: profiles.role });
  const token = await createSession(user.id, req.headers.get("user-agent"));
  await setSessionCookie(token);
  return json({ user, token }, 201);
});
