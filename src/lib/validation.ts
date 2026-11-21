/** Strip control characters and angle brackets, trim and cap length. */
export function clean(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

/** Returns a 10-digit Indian mobile number or null. Accepts +91 / 91 / 0 prefixes. */
export function normalizePhone(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function normalizeEmail(value: unknown): string | null {
  const v = clean(value, 120).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
}

export const isPincode = (v: unknown): v is string => typeof v === "string" && /^[0-9]{6}$/.test(v);

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 100) return "Password is too long";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must include letters and numbers";
  return null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
