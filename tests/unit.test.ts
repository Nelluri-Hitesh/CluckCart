import assert from "node:assert/strict";
import test from "node:test";
import { computeTotals, couponDiscount, deliveryFeeFor, linePrice, packPrice } from "../src/lib/pricing";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { hmacHex, verifyCheckoutSignature, verifyWebhookSignature } from "../src/lib/razorpay";
import { clean, isPincode, normalizePhone, passwordProblem } from "../src/lib/validation";
import { TRANSITIONS } from "../src/lib/order-status";
import { weightLabel } from "../src/lib/format";

test("pack and line prices are derived from price per kg", () => {
  assert.equal(packPrice(240, 250), 60);
  assert.equal(packPrice(239, 500), 120); // 119.5 rounds to 120
  assert.equal(packPrice(259, 750), 194); // custom weight
  assert.equal(linePrice(240, 1000, 3), 720);
});

test("cart totals: subtotal, coupon, delivery fee and total", () => {
  const subtotal = linePrice(240, 1000, 1) + linePrice(240, 500, 2); // 240 + 240
  assert.equal(subtotal, 480);
  const discount = couponDiscount({ type: "flat", value: 50, minOrder: 299, maxDiscount: null }, subtotal);
  assert.equal(discount, 50);
  const fee = deliveryFeeFor(subtotal - discount, 40, 599);
  assert.equal(fee, 40);
  assert.deepEqual(computeTotals({ subtotal, discount, deliveryFee: fee, taxPercent: 0 }), { tax: 0, total: 470 });
});

test("free delivery applies at the threshold", () => {
  assert.equal(deliveryFeeFor(599, 40, 599), 0);
  assert.equal(deliveryFeeFor(598, 40, 599), 40);
  assert.equal(deliveryFeeFor(5000, 40, 0), 40); // 0 disables free delivery
});

test("coupon rules: minimum order, percent cap, never above subtotal", () => {
  const pct = { type: "percent" as const, value: 10, minOrder: 499, maxDiscount: 100 };
  assert.equal(couponDiscount(pct, 400), 0);
  assert.equal(couponDiscount(pct, 800), 80);
  assert.equal(couponDiscount(pct, 2000), 100);
  assert.equal(couponDiscount({ type: "flat", value: 500, minOrder: 0, maxDiscount: null }, 300), 300);
});

test("inclusive tax is extracted without changing the total", () => {
  const r = computeTotals({ subtotal: 1050, discount: 0, deliveryFee: 0, taxPercent: 5 });
  assert.equal(r.total, 1050);
  assert.equal(r.tax, 50);
});

test("passwords are hashed with salt and verified", async () => {
  const h1 = await hashPassword("Secret123");
  const h2 = await hashPassword("Secret123");
  assert.notEqual(h1, h2);
  assert.ok(!h1.includes("Secret123"));
  assert.equal(await verifyPassword("Secret123", h1), true);
  assert.equal(await verifyPassword("secret123", h1), false);
});

test("Razorpay checkout signature verification", () => {
  const secret = "test_secret";
  const sig = hmacHex("order_1|pay_1", secret);
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", sig, secret), true);
  assert.equal(verifyCheckoutSignature("order_1", "pay_2", sig, secret), false);
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", "deadbeef", secret), false);
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", sig, ""), false);
});

test("Razorpay webhook signature verification", () => {
  const body = JSON.stringify({ event: "payment.captured" });
  const sig = hmacHex(body, "whsec");
  assert.equal(verifyWebhookSignature(body, sig, "whsec"), true);
  assert.equal(verifyWebhookSignature(body + " ", sig, "whsec"), false);
  assert.equal(verifyWebhookSignature(body, sig, ""), false);
});

test("input validation and sanitisation", () => {
  assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizePhone("09876543210"), "9876543210");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("5876543210"), null);
  assert.equal(isPincode("500081"), true);
  assert.equal(isPincode("50008"), false);
  assert.equal(clean("  <script>alert(1)</script>\u0000 hi "), "scriptalert(1)/script  hi");
  assert.ok(passwordProblem("short1"));
  assert.ok(passwordProblem("onlyletters"));
  assert.equal(passwordProblem("Chicken123"), null);
});

test("order status machine does not allow skipping or leaving terminal states", () => {
  assert.ok(!TRANSITIONS.placed.includes("delivered"));
  assert.deepEqual(TRANSITIONS.delivered, []);
  assert.deepEqual(TRANSITIONS.cancelled, []);
});

test("weight labels", () => {
  assert.equal(weightLabel(250), "250 g");
  assert.equal(weightLabel(1000), "1 kg");
  assert.equal(weightLabel(1500), "1.5 kg");
  assert.equal(weightLabel(1250), "1.25 kg");
});
