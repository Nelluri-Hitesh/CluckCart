# Deployment guide

> Nothing has been deployed by this project. These are the steps *you* follow. Prices of third-party services change — check their pricing pages.

The app is one Next.js project (website + admin + delivery app + API) and one PostgreSQL database. Admin and delivery live at `/admin` and `/delivery`; you can point `admin.yourdomain.in` at the same deployment if you want a separate hostname.

## 1. Database

Pick one managed PostgreSQL: **Supabase** (Postgres only), **Neon**, **Railway**, or **AWS RDS**. Choose a region near Hyderabad (e.g. Mumbai / ap-south-1). Copy its connection string:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
```

Create the tables from your computer once:
```powershell
$env:DATABASE_URL="postgresql://..."   # the production URL
npx drizzle-kit push                    # (edit drizzle.config.json url or use a drizzle.config.ts that reads DATABASE_URL)
```
For a team workflow use `npx drizzle-kit generate` (creates SQL migration files in git) and `npx drizzle-kit migrate`. The first request to the site seeds categories, products, zones, slots, settings and the first admin from `ADMIN_*` env vars.

## 2. Website + admin + API (Vercel)

1. Push the project to GitHub. 2. vercel.com → Add New Project → import it. 3. Add environment variables from `.env.example` (Production): `DATABASE_URL`, `APP_URL=https://www.yourdomain.in`, `ADMIN_EMAIL/PHONE/PASSWORD`, `SEED_DEMO_USERS=false`, Razorpay and Resend keys. 4. Deploy.

**Important on serverless hosts:** product-image uploads are written to local disk, which Vercel does not keep. Before launching on Vercel, change `src/app/api/admin/upload/route.ts` to store files in S3 / Cloudflare R2 / Supabase Storage (or paste image URLs into the product form, which already works). A single VPS/Railway/Render server with a persistent disk works without changes.

**Domain & HTTPS:** Vercel → Settings → Domains → add `www.yourdomain.in`; at your registrar add the CNAME/A records Vercel shows. HTTPS certificates are automatic. Cookies become `Secure` automatically (`x-forwarded-proto: https`).

## 3. Razorpay production setup

1. Create a Razorpay account and complete KYC (business PAN, bank account) — required for live mode.
2. **Test first:** Dashboard → Test Mode → API Keys → set `RAZORPAY_KEY_ID=rzp_test_…` and `RAZORPAY_KEY_SECRET`. Place an order with Razorpay's test UPI/card details. The admin Payments page shows "TEST mode".
3. **Webhook:** Dashboard → Settings → Webhooks → Add → URL `https://www.yourdomain.in/api/payments/webhook`, choose a secret, set it as `RAZORPAY_WEBHOOK_SECRET`, tick `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.
4. **Go live:** switch to Live Mode, generate live keys, replace the env vars, redeploy. Do one real ₹1–₹10 order and refund it from Admin → Orders. The Payments page then shows "LIVE payments".
5. Razorpay's standard fee is a percentage per transaction plus GST — confirm on their pricing page.

## 4. Notifications
See `04-NOTIFICATIONS-AND-COSTS.md`.

## 5. Backups & monitoring

- **Backups:** enable your database provider's daily automatic backups + point-in-time recovery (Supabase Pro / Neon / RDS all offer it). Also keep a weekly `pg_dump` off-site: `pg_dump "$DATABASE_URL" -Fc -f chickenmart-$(date +%F).dump`. **Test a restore** once before launch.
- **Monitoring:** `/api/health` is a ready-made uptime endpoint — point UptimeRobot/Better Stack at it. Add Sentry (`npm i @sentry/nextjs`) for error tracking. Watch Razorpay's webhook delivery log for failures.
- **Before launch checklist:** change all demo passwords / set `SEED_DEMO_USERS=false`; delete the demo rider and customer; use live Razorpay keys; set real prices, stock, PIN codes and contact details; confirm GST and put your FSSAI number on invoices (Settings → GSTIN field / invoice template).

## 6. Android & iPhone

### Today: installable web apps (no store needed)
- **Customers & delivery staff on Android (Chrome):** open the site → ⋮ → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** Share → *Add to Home Screen*.
The manifest is served from `/manifest.webmanifest`. Delivery staff use `/delivery`. (A service worker for offline support is not included.)

### Native apps with Expo (not built yet — next stage)
The REST API is ready: `POST /api/auth/login` returns `{ token }`; send it as `Authorization: Bearer <token>` to `/api/products`, `/api/checkout/quote`, `/api/addresses`, `/api/slots`, `/api/orders`, `/api/payments/verify`, `/api/delivery/assignments/:id`, `/api/notifications`. To build the app:
```bash
npx create-expo-app chickenmart-mobile --template blank-typescript
cd chickenmart-mobile && npx expo install expo-router expo-secure-store expo-notifications react-native-razorpay
```
**Accounts you need:** Expo account (free), **Google Play Console** (one-time US$25), **Apple Developer Program** (US$99/year, needs a Mac only if you build locally — EAS builds in the cloud).
**Android:** `npm i -g eas-cli && eas login && eas build:configure && eas build -p android --profile production` produces an **.aab** for Play Store (use `--profile preview` with `"buildType": "apk"` for an installable test **.apk**). Upload to Play Console → Internal testing → Production.
**iOS:** `eas build -p ios --profile production`, then `eas submit -p ios` → TestFlight → App Store review. Apple requires a privacy policy URL and account-deletion support.
Push notifications need Expo push tokens or FCM/APNs and a small `push_tokens` table + sender — not implemented yet.
