import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions } from "@/db/schema";
import { AppError } from "./errors";
import { hashToken, newToken } from "./password";

export const SESSION_COOKIE = "cm_session";
const SESSION_DAYS = 30;

export type Role = "customer" | "admin" | "delivery";
export type SessionUser = { id: string; name: string; phone: string; email: string | null; role: Role };

export const roleHome = (role: Role) => (role === "admin" ? "/admin" : role === "delivery" ? "/delivery" : "/");

export async function createSession(userId: string, userAgent?: string | null) {
  const token = newToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 200) ?? null,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const h = await headers();
  const https = h.get("x-forwarded-proto") === "https" || process.env.COOKIE_SECURE === "true";
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Reads the session from the cookie (web) or an `Authorization: Bearer` header (mobile apps). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const h = await headers();
  const auth = h.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: profiles.id, name: profiles.name, phone: profiles.phone, email: profiles.email, role: profiles.role })
    .from(sessions)
    .innerJoin(profiles, eq(sessions.userId, profiles.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(profiles.isActive, true)))
    .limit(1);
  return (rows[0] as SessionUser | undefined) ?? null;
});

/** For pages: redirect to login, or to the user's own home if their role is not allowed. */
export async function requirePage(roles: Role[], next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!roles.includes(user.role)) redirect(roleHome(user.role));
  return user;
}

/** For API routes and server actions: throws 401/403 AppErrors. */
export async function requireApi(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Please log in to continue", 401);
  if (roles && !roles.includes(user.role)) throw new AppError("You do not have permission to do this", 403);
  return user;
}
