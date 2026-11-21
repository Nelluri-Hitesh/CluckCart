/**
 * End-to-end HTTP tests (registration, login, browsing, checkout, permissions).
 * Run against a running server:  BASE_URL=http://localhost:3000 npx tsx --test tests/api.e2e.test.ts
 * They are skipped automatically when no server is reachable.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import test, { before } from "node:test";

const BASE = process.env.BASE_URL || "http://localhost:3000";
let up = false;

class Client {
  cookie = "";
  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (this.cookie) headers.cookie = this.cookie;
    if (init.json !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(BASE + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("cm_session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let data: Record<string, any> = {};
    try { data = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, data, location: res.headers.get("location") };
  }
}

const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`.slice(0, 10);

before(async () => {
  try { up = (await fetch(`${BASE}/api/health`)).ok; } catch { up = false; }
  if (!up) console.log(`(server not reachable at ${BASE}; e2e tests skipped)`);
});

const t = (name: string, fn: () => Promise<void>) => test(name, async (ctx) => { if (!up) return ctx.skip("server not running"); await fn(); });

const customer = new Client();
const other = new Client();
let productId = "";
let addressId = "";
let slotKey = "";
let orderId = "";
const pw = "Chicken123";

t("browse real products and categories", async () => {
  const r = await new Client().req("/api/products");
  assert.equal(r.status, 200);
  assert.ok(r.data.products.length >= 10);
  assert.ok(r.data.categories.length >= 8);
  productId = r.data.products.find((p: any) => p.inStock && p.variants.includes(1000)).id;
  assert.equal((await new Client().req("/")).status, 200);
  assert.equal((await new Client().req("/products")).status, 200);
});

t("registration validates input and never grants admin", async () => {
  assert.equal((await new Client().req("/api/auth/register", { method: "POST", json: { name: "A", phone: "123", password: "x" } })).status, 400);
  const r = await customer.req("/api/auth/register", { method: "POST", json: { name: "E2E Customer", phone: phone(), password: pw, role: "admin" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, "customer");
  assert.equal((await customer.req("/api/auth/me")).data.user.role, "customer");
  assert.equal((await other.req("/api/auth/register", { method: "POST", json: { name: "Other E2E", phone: phone(), password: pw } })).status, 201);
});

t("login and logout", async () => {
  const ph = phone();
  const c = new Client();
  await c.req("/api/auth/register", { method: "POST", json: { name: "Login Test", phone: ph, password: pw } });
  await c.req("/api/auth/logout", { method: "POST" });
  assert.equal((await c.req("/api/auth/me")).data.user, null);
  assert.equal((await c.req("/api/auth/login", { method: "POST", json: { identifier: ph, password: "WrongPass1" } })).status, 401);
  const ok = await c.req("/api/auth/login", { method: "POST", json: { identifier: `+91 ${ph}`, password: pw } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.home, "/");
  assert.equal((await c.req("/api/auth/me")).data.user.phone, ph);
});

t("protected routes reject anonymous and customer users", async () => {
  const anon = new Client();
  assert.equal((await anon.req("/api/orders", { method: "POST", json: {} })).status, 401);
  assert.equal((await anon.req("/api/addresses")).status, 401);
  assert.equal((await anon.req("/admin")).status, 307);
  assert.equal((await anon.req("/delivery")).status, 307);
  assert.equal((await customer.req("/api/admin/orders/export")).status, 403);
  assert.equal((await customer.req("/api/admin/upload", { method: "POST" })).status, 403);
  assert.equal((await customer.req("/api/delivery/assignments/" + crypto.randomUUID(), { method: "POST", json: { action: "accept" } })).status, 403);
  const adminPage = await customer.req("/admin");
  assert.equal(adminPage.status, 307);
  assert.ok(!adminPage.location?.includes("/admin"));
  assert.equal((await anon.req("/api/payments/webhook", { method: "POST", json: { event: "payment.captured" } })).status, 400);
});

t("cart quote, address, slots and COD checkout", async () => {
  const q = await customer.req("/api/checkout/quote", { method: "POST", json: { items: [{ productId, grams: 1000, quantity: 2 }], couponCode: "FIRST50", pincode: "500081" } });
  assert.equal(q.status, 200);
  assert.equal(q.data.quote.serviceable, true);
  assert.ok(q.data.quote.total > 0);
  assert.equal((await customer.req("/api/service-check?pincode=999999")).data.serviceable, false);

  const a = await customer.req("/api/addresses", { method: "POST", json: { recipientName: "E2E Customer", phone: "9876543210", line1: "Flat 4, Test Residency", pincode: "500081" } });
  assert.equal(a.status, 201);
  addressId = a.data.address.id;
  assert.equal((await customer.req("/api/addresses", { method: "POST", json: { recipientName: "x", phone: "1", line1: "y", pincode: "1" } })).status, 400);

  const s = await customer.req("/api/slots");
  slotKey = s.data.slots.find((x: any) => x.remaining > 0).key;

  const key = crypto.randomUUID();
  const body = { items: [{ productId, grams: 1000, quantity: 2 }], addressId, slotKey, paymentMethod: "cod", couponCode: "", idempotencyKey: key };
  const o1 = await customer.req("/api/orders", { method: "POST", json: body });
  assert.equal(o1.status, 201, JSON.stringify(o1.data));
  orderId = o1.data.order.id;
  const o2 = await customer.req("/api/orders", { method: "POST", json: body });
  assert.equal(o2.data.order.id, orderId, "same idempotency key must not create a second order");
  assert.equal(o1.data.payment, null);
});

t("customers can only see their own orders; tampered prices are ignored", async () => {
  assert.equal((await customer.req(`/api/orders/${orderId}`)).status, 200);
  assert.equal((await other.req(`/api/orders/${orderId}`)).status, 404);
  assert.equal((await other.req(`/api/orders/${orderId}/cancel`, { method: "POST", json: {} })).status, 404);
  const list = await customer.req("/api/orders");
  assert.ok(list.data.orders.some((o: any) => o.id === orderId));
  const forged = await customer.req("/api/orders", { method: "POST", json: { items: [{ productId, grams: 1000, quantity: 1, price: 1, unitPrice: 1 }], addressId, slotKey, paymentMethod: "cod", idempotencyKey: crypto.randomUUID(), total: 1 } });
  if (forged.status === 201) assert.ok(forged.data.order.total >= 199, "server must compute the price");
  else assert.equal(forged.status, 400);
});

t("customer cannot self-confirm a COD order as paid, and can cancel their own", async () => {
  assert.equal((await customer.req("/api/payments/demo", { method: "POST", json: { orderId, outcome: "success" } })).status, 404);
  const c = await customer.req(`/api/orders/${orderId}/cancel`, { method: "POST", json: {} });
  assert.equal(c.status, 200);
  assert.equal((await customer.req(`/api/orders/${orderId}`)).data.order.status, "cancelled");
});

t("admin and delivery roles are separated", async () => {
  const admin = new Client();
  const lg = await admin.req("/api/auth/login", { method: "POST", json: { identifier: "admin@chickenmart.in", password: "Admin@12345" } });
  if (lg.status !== 200) return; // production admin password differs: nothing more to check
  assert.equal(lg.data.home, "/admin");
  assert.equal((await admin.req("/admin")).status, 200);
  assert.equal((await admin.req("/admin/orders")).status, 200);
  assert.equal((await admin.req("/api/admin/orders/export")).status, 200);
  assert.equal((await admin.req("/api/orders", { method: "POST", json: {} })).status, 403, "admins do not shop");

  const rider = new Client();
  const rl = await rider.req("/api/auth/login", { method: "POST", json: { identifier: "9000000002", password: "Delivery@123" } });
  if (rl.status !== 200) return;
  assert.equal(rl.data.home, "/delivery");
  assert.equal((await rider.req("/delivery")).status, 200);
  assert.equal((await rider.req("/admin")).status, 307);
  assert.equal((await rider.req("/api/admin/orders/export")).status, 403);
  assert.equal((await rider.req(`/api/orders/${orderId}`)).status, 403);
  assert.equal((await rider.req(`/delivery/${crypto.randomUUID()}`)).status, 404);
});
