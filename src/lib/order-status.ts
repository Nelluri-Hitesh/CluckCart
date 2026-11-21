export const STATUS_LABEL: Record<string, string> = {
  placed: "Order placed",
  payment_confirmed: "Payment confirmed",
  accepted: "Order accepted",
  preparing: "Preparing",
  ready_for_dispatch: "Ready for dispatch",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_FLOW = [
  "placed",
  "payment_confirmed",
  "accepted",
  "preparing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
] as const;

export const TRANSITIONS: Record<string, string[]> = {
  placed: ["accepted", "cancelled"],
  payment_confirmed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "ready_for_dispatch"],
  delivered: [],
  cancelled: [],
};

export const CUSTOMER_CANCELLABLE = ["placed", "payment_confirmed", "accepted"];

export const statusTone: Record<string, string> = {
  placed: "bg-amber-50 text-amber-700 ring-amber-200",
  payment_confirmed: "bg-sky-50 text-sky-700 ring-sky-200",
  accepted: "bg-sky-50 text-sky-700 ring-sky-200",
  preparing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  ready_for_dispatch: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  out_for_delivery: "bg-orange-50 text-orange-700 ring-orange-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};
