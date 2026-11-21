# Architecture

## Stack — and where it differs from your brief

| Layer | Used | Your brief |
|---|---|---|
| Website, admin, delivery app | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 | same |
| Database | PostgreSQL + Drizzle ORM | PostgreSQL (via Supabase) |
| Auth | Own session auth: scrypt-hashed passwords, random 256-bit session tokens stored **hashed** in the DB, HttpOnly SameSite=Lax cookie (web) or `Authorization: Bearer` (mobile) | Supabase Auth |
| Images | Admin upload → server validates magic bytes → stored under `uploads/` and served by `/api/uploads/*` | Supabase Storage |
| Payments | Razorpay REST API + Checkout.js (no SDK dependency) | same |
| Maps/navigation | "Navigate" button opens Google Maps directions (lat/lng if the customer pinned their location, else the address). No Maps API key needed. | Google Maps |
| Email | Resend (REST) | SMS/email/push |
| Mobile | Installable PWA for customers and delivery staff. Native Expo app **not built yet**. | React Native / Expo |

### Why not Supabase here?
This project was built inside a fixed environment that provides a local PostgreSQL database and Next.js, with no Supabase project or credentials. Rather than ship code that cannot run or be tested, I implemented the same guarantees directly:

- **Row-Level-Security equivalent:** every query that returns customer data is scoped by the caller's id (`WHERE user_id = session.user.id`), and role checks (`requireApi(['admin'])`, `requirePage([...])`) run on every route and server action. Delivery staff queries are scoped by `staff_id`, so another rider's assignment returns 404.
- **Database-level protection:** `CHECK` constraints for roles, statuses, non-negative stock, positive prices; unique indexes for order numbers, idempotency keys, payment ids, one active assignment per order.
- The schema is plain PostgreSQL, so you can host it on **Supabase Postgres** (just change `DATABASE_URL`) and keep everything working. If you later want true RLS or Supabase Auth, that is a contained migration of `src/lib/session.ts` plus policies.

## Database (24 tables, `src/db/schema.ts`)

`profiles` (role per account: customer/admin/delivery) · `sessions` · `password_resets` · `customer_addresses` · `categories` · `products` · `product_images` · `product_variants` · `inventory` · `delivery_zones` · `delivery_slots` · `coupons` · `coupon_redemptions` · `orders` · `order_items` · `order_status_history` · `payments` · `webhook_events` · `refunds` · `delivery_staff` · `delivery_assignments` · `delivery_status_history` · `notifications` · `business_settings`.

**Cart:** kept in the browser (localStorage) for instant updates and is *never trusted* — the server re-reads every price, weight and stock level at quote and order time. (So there are no `carts` / `cart_items` tables; this was a deliberate simplification.)

Money is `numeric(10,2)`; all calculations use whole rupees. Stock is integer **grams** per product, so 250 g / 500 g / 1 kg / custom packs all draw from one pool.

## Order & payment flow

1. Client sends cart + address + slot + method + an **idempotency key**.
2. Server re-prices, validates PIN code, minimum order, slot capacity, coupon, COD limit.
3. In one DB transaction: stock is deducted with `UPDATE … WHERE stock_grams >= n` (atomic, so no overselling), order + items + payment row + history + coupon redemption are written.
4. COD: done. Online: server creates a Razorpay order; browser opens Checkout; the callback is **verified server-side** (HMAC-SHA256 of `order_id|payment_id` with your secret). The **webhook** (`/api/payments/webhook`) independently confirms `payment.captured`, checks the amount, and is de-duplicated by event id. Both paths call the same idempotent `markOrderPaid`.
5. Unpaid online orders expire after 30 min (configurable) and return stock. A payment that arrives after expiry is auto-queued for refund.
6. Cancellation returns stock, releases the coupon, and queues a refund for paid online orders. Admin processes refunds (Razorpay refund API; webhook `refund.processed` confirms).

Test vs live is derived from the key prefix (`rzp_test_` / `rzp_live_`); with no keys the **demo gateway** appears, labelled "Demo mode — no real money", and refuses to work once real keys are configured.

## Security measures implemented

Role-based access on every page/route/action · customers can only register as `customer` · admin/delivery created only by admin (or first-run env) · passwords scrypt-hashed, rate-limited login/register/reset · sessions revocable, password change signs out other devices · generic reset response (no account enumeration) · server-side validation + sanitisation of all inputs · price/total never taken from the client · customers cannot set payment status (demo endpoint is disabled when real keys exist) · image upload verified by magic bytes, random file names, `nosniff` · CSV export neutralises formula injection · secrets only in server env vars · SameSite=Lax cookies (CSRF) and Next.js's built-in Origin check on server actions · DB constraints as a last line of defence.

**Known limits:** rate limiting is in-memory (use Redis/Upstash if you run several servers); uploaded images live on local disk (use S3/R2/Supabase Storage on serverless hosts); no OTP login yet (needs an SMS provider); no automatic geofenced service areas (PIN-code list only).

## Business decisions you must configure (all editable in Admin → Settings unless noted)

| Decision | Development default | Where |
|---|---|---|
| Prices, MRP, stock per product | Illustrative Hyderabad prices (e.g. curry cut ₹239/kg) — **replace with yours** | Admin → Products |
| Delivery fee | ₹40 | Settings |
| Free delivery above | ₹599 | Settings |
| Minimum order | ₹199 | Settings |
| COD limit | ₹3,000 | Settings |
| Service areas | 19 Hyderabad PIN codes (verify!) | Settings → Service areas |
| Delivery slots | 5 slots, 7 AM – 8 PM, 20–30 orders each, today's slots close 60 min before start | Settings |
| Opening hours | 7:00 – 21:00 (shown on site; slots control when you deliver) | Settings |
| GST | 0% (fresh unprocessed chicken is generally exempt — confirm with your accountant) | Settings |
| Coupons | FIRST50, CHICKEN10, FREESHIP | Admin → Coupons |
| Contact info | placeholder phone/email | Settings |
| Refund policy | Full refund on cancellation of paid online orders; partial refunds by admin | `src/lib/orders.ts` |
| Razorpay account & KYC, FSSAI licence on invoices, domain, logo | yours to provide | — |
