import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, profiles } from "@/db/schema";

/** Sends email through Resend when RESEND_API_KEY is configured; otherwise logs it. Never throws. */
export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email not configured] to=${to} subject="${subject}"`);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Chicken Mart <orders@chickenmart.in>",
        to,
        subject,
        text,
      }),
    });
  } catch (e) {
    console.error("email failed", e);
  }
}

/** Stores an in-app notification and mirrors it to email when the customer has one. */
export async function notify(userId: string, orderId: string | null, type: string, title: string, body: string) {
  try {
    await db.insert(notifications).values({ userId, orderId, type, title, body });
    const [u] = await db.select({ email: profiles.email, role: profiles.role }).from(profiles).where(eq(profiles.id, userId)).limit(1);
    if (u?.email && u.role === "customer") await sendEmail(u.email, title, body);
  } catch (e) {
    console.error("notify failed", e);
  }
}
