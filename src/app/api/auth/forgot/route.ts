import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, profiles } from "@/db/schema";
import { clientIp, handler, json, rateLimit, readJson } from "@/lib/api";
import { sendEmail } from "@/lib/notify";
import { hashToken, newToken } from "@/lib/password";
import { clean, normalizeEmail, normalizePhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60_000);
  const body = await readJson(req);
  const identifier = clean(body.identifier, 120).toLowerCase();
  const phone = normalizePhone(identifier);
  const email = identifier.includes("@") ? normalizeEmail(identifier) : null;
  const [user] =
    phone || email
      ? await db.select().from(profiles).where(phone ? eq(profiles.phone, phone) : eq(profiles.email, email!)).limit(1)
      : [];
  if (user && user.isActive && user.email) {
    const token = newToken();
    await db.insert(passwordResets).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) });
    const base = process.env.APP_URL || `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("x-forwarded-host") || req.headers.get("host")}`;
    const link = `${base}/reset-password?token=${token}`;
    if (!process.env.RESEND_API_KEY) console.log(`[password reset link for ${user.email}] ${link}`);
    await sendEmail(user.email, "Reset your Chicken Mart password", `Use this link within 1 hour to set a new password:\n\n${link}\n\nIf you did not ask for this, ignore this email.`);
  }
  // Same answer whether or not the account exists (prevents account enumeration).
  return json({ ok: true, message: "If an account with an email exists, we have sent a reset link." });
});
