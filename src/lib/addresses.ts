import { AppError } from "./errors";
import { clean, isPincode, normalizePhone } from "./validation";

export function parseAddress(body: Record<string, unknown>) {
  const phone = normalizePhone(body.phone);
  const recipientName = clean(body.recipientName, 80);
  const line1 = clean(body.line1, 160);
  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : "";
  if (recipientName.length < 2) throw new AppError("Enter the receiver's name");
  if (!phone) throw new AppError("Enter a valid 10-digit mobile number");
  if (line1.length < 4) throw new AppError("Enter the house / flat / street");
  if (!isPincode(pincode)) throw new AppError("Enter a valid 6-digit PIN code");
  const lat = body.latitude === "" || body.latitude == null ? null : Number(body.latitude);
  const lng = body.longitude === "" || body.longitude == null ? null : Number(body.longitude);
  return {
    label: clean(body.label, 20) || "Home",
    recipientName,
    phone,
    line1,
    line2: clean(body.line2, 160) || null,
    landmark: clean(body.landmark, 120) || null,
    area: clean(body.area, 80) || null,
    city: clean(body.city, 60) || "Hyderabad",
    state: clean(body.state, 60) || "Telangana",
    pincode,
    latitude: lat != null && Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
    longitude: lng != null && Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
  };
}
