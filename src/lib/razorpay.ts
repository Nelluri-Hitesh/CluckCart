import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

export type PaymentMode = "live" | "test" | "demo";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const mode: PaymentMode = !keyId || !keySecret ? "demo" : keyId.startsWith("rzp_live_") ? "live" : "test";
  return { keyId, keySecret, webhookSecret, mode };
}

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function hmacHex(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Checkout signature = HMAC_SHA256(razorpay_order_id|razorpay_payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!secret || !signature) return false;
  return safeEqualHex(hmacHex(`${orderId}|${paymentId}`, secret), signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  if (!secret || !signature) return false;
  return safeEqualHex(hmacHex(rawBody, secret), signature);
}

async function rzp<T>(path: string, body: unknown): Promise<T> {
  const { keyId, keySecret } = razorpayConfig();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error("Razorpay error", path, data);
    throw new AppError(data.error?.description || "Payment gateway error", 502);
  }
  return data;
}

export const createRazorpayOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  rzp<{ id: string }>("/orders", { amount: amountPaise, currency: "INR", receipt, notes });

export const refundRazorpayPayment = (paymentId: string, amountPaise: number, receipt: string) =>
  rzp<{ id: string; status: string }>(`/payments/${paymentId}/refund`, {
    amount: amountPaise,
    speed: "normal",
    receipt,
  });
