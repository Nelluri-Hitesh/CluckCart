export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function weightLabel(g: number) {
  if (g < 1000) return `${g} g`;
  if (g % 1000 === 0) return `${g / 1000} kg`;
  return `${(g / 1000).toFixed(2).replace(/\.?0+$/, "")} kg`;
}

/** Current date (YYYY-MM-DD) and minutes-since-midnight in India Standard Time. */
export function istNow(d = new Date()) {
  const t = new Date(d.getTime() + 19_800_000);
  return { date: t.toISOString().slice(0, 10), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

export function addDays(date: string, n: number) {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export function discountPercent(price: number, mrp: number) {
  return mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
}
