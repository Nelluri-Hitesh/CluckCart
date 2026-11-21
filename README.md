# Chicken Mart — chicken e-commerce & delivery platform

A single-owner online chicken shop for Hyderabad: customer storefront, admin dashboard and delivery-staff app, all on one Next.js codebase, one PostgreSQL database and one set of REST APIs.

> **Read this first — what is and is not finished.** See the status table below. Nothing here has been deployed or published; the app runs locally and in the preview.

## Status against your "definition of complete"

| Requirement | Status |
|---|---|
| Customers register / log in / recover password | ✅ Done (phone **or** email + password; reset link by email) |
| Browse real products, categories, search, filter, sort | ✅ Done (18 seeded products, 11 categories, generated product photos) |
| Cart (250 g / 500 g / 1 kg / custom weight), coupons, delivery fee | ✅ Done |
| Checkout: address, PIN-code serviceability, delivery slot, COD / online | ✅ Done |
| Razorpay payments with server-side verification + webhooks | ✅ Implemented. **Not tested against the real Razorpay servers** (needs your keys). Without keys a clearly labelled **DEMO gateway** is used. |
| Stock reserved atomically, restored on cancel, no overselling | ✅ Done and tested (concurrent-order test) |
| Order tracking, cancellation, refunds | ✅ Done |
| Admin dashboard (products, stock, orders, refunds, customers, delivery, coupons, payments, reports, settings) | ✅ Done |
| Delivery-staff app (assignments, accept, navigate, call, status, failed attempt, history) | ✅ Done as a **mobile-first installable web app (PWA)** at `/delivery` |
| Notifications | ✅ In-app + email (Resend). ❌ SMS and push are **not** wired (see `docs/04-NOTIFICATIONS-AND-COSTS.md`) |
| Tests | ✅ 24 unit/integration + 8 HTTP end-to-end tests pass |
| Android / iPhone **native** apps (Expo) | ❌ **Not built.** The website and delivery app are installable on both phones as PWAs today. A native Expo app is a separate stage — the REST API already accepts `Authorization: Bearer` tokens for it. |
| Supabase (Auth, RLS, Storage) | ❌ **Not used** — see "Why not Supabase" in `docs/02-ARCHITECTURE.md`. The same security rules are enforced in server code and PostgreSQL constraints. |
| Production deployment | ❌ Not done. Guide in `docs/03-DEPLOYMENT.md`. |

## Demo accounts (created automatically on first run — change/remove before going live)

| Role | Login | Password |
|---|---|---|
| Admin | `admin@chickenmart.in` (or phone `9000000001`) | `Admin@12345` (or `ADMIN_PASSWORD` from env) |
| Delivery | `9000000002` | `Delivery@123` |
| Customer | `9000000003` | `Customer@123` |

Admins log in at `/login` and are sent to `/admin`; delivery staff go to `/delivery`; customers to the store.

## Run it

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env   then edit DATABASE_URL
npx drizzle-kit push          # creates all tables
npx tsx scripts/seed.ts       # optional: the app also seeds itself on first request
npm run dev                   # http://localhost:3000
```

Full beginner walk-through for Windows 10: `docs/01-WINDOWS-SETUP.md`.

## Run the tests

```bash
npx tsx --test tests/unit.test.ts tests/orders.integration.test.ts      # logic + database (needs DATABASE_URL)
npm run build && npx next start -p 3100                                 # in one terminal …
set BASE_URL=http://localhost:3100 && npx tsx --test tests/api.e2e.test.ts   # … and this in another (PowerShell: $env:BASE_URL="http://localhost:3100")
```

What they cover: pricing and coupon maths, password hashing, Razorpay signature checks, input validation, order creation, idempotency, overselling under concurrency, payment confirmation (idempotent), late payments, refunds, cancellation rules, status machine, delivery assignment / failed attempt / COD collection, rider isolation, DB constraints; over HTTP: registration (cannot become admin), login/logout, browsing, quote, address, slots, COD checkout, order isolation between customers, admin/delivery/customer route protection.

## Where things are

```
src/app/(shop)/…      customer storefront (home, products, product, checkout, orders, account, auth)
src/app/admin/…       admin dashboard (server actions in actions.ts)
src/app/delivery/…    delivery-staff app
src/app/api/…         REST API shared by website, delivery app and future mobile apps
src/lib/orders.ts     quoting, order creation, payments, cancellation, refunds, status machine
src/lib/delivery.ts   rider operations (scoped to the rider's own assignments)
src/db/schema.ts      24-table PostgreSQL schema (Drizzle)     src/db/seed.ts   starter data
tests/                unit, database and HTTP tests            docs/            guides
```
