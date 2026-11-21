# Notifications — what exists, what to add, approximate costs

## Implemented now
Every important event writes an **in-app notification** (visible under *My account → Notifications*) and, if the customer has an email and `RESEND_API_KEY` is set, sends the same message by **email**:

| Event | Message |
|---|---|
| Order placed | `order_placed` |
| Payment successful (or late payment → refund) | `payment_success` |
| Order accepted / preparing / ready | `order_accepted`, `order_status` |
| Out for delivery | `order_dispatched` |
| Delivered | `order_delivered` |
| Delivery attempt failed | `delivery_failed` |
| Cancelled | `order_cancelled` |
| Refund initiated / completed | `refund_update` |
| New delivery assigned (to rider) | `delivery_assigned` |

Without `RESEND_API_KEY` emails are only logged to the server console (also true of password-reset links — handy in development).

## Not implemented (you decide)
- **SMS** (India requires DLT registration of sender ID and templates). Providers: **MSG91**, **Gupshup**, **Twilio**. Add a `sendSms()` next to `sendEmail()` in `src/lib/notify.ts` and call it from `notify()`.
- **WhatsApp** order updates: Meta WhatsApp Business Cloud API (approved templates).
- **Push notifications:** arrive with the native Expo app (Expo Push / FCM / APNs).
- **Mobile-number OTP login:** needs the SMS provider above.

## Approximate costs (check current pricing — these change)
| Service | Typical cost |
|---|---|
| Vercel Hobby (non-commercial) / Pro | Free / ~US$20 per member per month — a business should use Pro |
| Managed Postgres (Supabase / Neon / Railway) | Free tier to start, ~US$10–25/month for a production plan with backups |
| Resend email | Free tier (a few thousand emails/month), then ~US$20/month |
| SMS in India | roughly ₹0.15–₹0.25 per SMS plus DLT setup |
| Razorpay | % fee per transaction (+GST), no monthly fee for standard plan |
| Domain `.in` | ~₹600–900/year |
| Google Play / Apple | US$25 once / US$99 per year |
