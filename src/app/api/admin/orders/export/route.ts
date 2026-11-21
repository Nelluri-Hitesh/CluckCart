import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { handler } from "@/lib/api";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

// Prefix risky leading characters so spreadsheet apps do not execute cell contents as formulas.
const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET = handler(async (req) => {
  await requireApi(["admin"]);
  const status = new URL(req.url).searchParams.get("status");
  const rows = await db
    .select()
    .from(orders)
    .where(and(status ? eq(orders.status, status) : undefined))
    .orderBy(desc(orders.createdAt))
    .limit(5000);
  const head = ["Order", "Date", "Customer", "Phone", "Status", "Payment method", "Payment status", "Subtotal", "Discount", "Delivery", "Total", "Pincode"];
  const lines = [head.map(cell).join(",")];
  for (const o of rows) {
    lines.push(
      [o.orderNumber, o.createdAt.toISOString(), o.customerName, o.customerPhone, o.status, o.paymentMethod, o.paymentStatus, o.subtotal, o.discount, o.deliveryFee, o.total, o.address.pincode]
        .map(cell)
        .join(","),
    );
  }
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="orders.csv"', "Cache-Control": "no-store" },
  });
});
