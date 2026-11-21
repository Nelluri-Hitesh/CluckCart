/** Pure pricing helpers. All amounts are whole rupees so totals never drift by paise. */

export function packPrice(pricePerKg: number, grams: number) {
  return Math.round((pricePerKg * grams) / 1000);
}

export function linePrice(pricePerKg: number, grams: number, quantity: number) {
  return packPrice(pricePerKg, grams) * quantity;
}

export type CouponRule = {
  type: "percent" | "flat";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
};

export function couponDiscount(rule: CouponRule, subtotal: number) {
  if (subtotal < rule.minOrder) return 0;
  let d = rule.type === "percent" ? Math.round((subtotal * rule.value) / 100) : Math.round(rule.value);
  if (rule.maxDiscount != null) d = Math.min(d, rule.maxDiscount);
  return Math.max(0, Math.min(d, subtotal));
}

export function deliveryFeeFor(amountAfterDiscount: number, baseFee: number, freeAbove: number) {
  return freeAbove > 0 && amountAfterDiscount >= freeAbove ? 0 : baseFee;
}

/** Prices are tax-inclusive; `tax` is the GST portion contained in the taxable amount (informational). */
export function computeTotals(p: { subtotal: number; discount: number; deliveryFee: number; taxPercent: number }) {
  const taxable = Math.max(0, p.subtotal - p.discount);
  const tax = p.taxPercent > 0 ? Math.round(taxable - taxable / (1 + p.taxPercent / 100)) : 0;
  return { tax, total: taxable + p.deliveryFee };
}
