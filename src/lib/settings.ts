import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessSettings } from "@/db/schema";

export type Settings = {
  shopName: string;
  shopOpen: boolean;
  openTime: string;
  closeTime: string;
  deliveryFee: number;
  freeDeliveryAbove: number;
  minOrder: number;
  codMaxOrder: number;
  taxPercent: number;
  gstin: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  slotLeadMinutes: number;
  paymentTimeoutMinutes: number;
};

export const defaultSettings: Settings = {
  shopName: "Chicken Mart",
  shopOpen: true,
  openTime: "07:00",
  closeTime: "21:00",
  deliveryFee: 40,
  freeDeliveryAbove: 599,
  minOrder: 199,
  codMaxOrder: 3000,
  taxPercent: 0,
  gstin: "",
  phone: "+91 90000 00000",
  email: "support@chickenmart.in",
  whatsapp: "+91 90000 00000",
  address: "Hyderabad, Telangana, India",
  slotLeadMinutes: 60,
  paymentTimeoutMinutes: 30,
};

export async function getSettings(): Promise<Settings> {
  const [row] = await db.select().from(businessSettings).where(eq(businessSettings.key, "shop")).limit(1);
  return { ...defaultSettings, ...((row?.value as Partial<Settings> | undefined) ?? {}) };
}

export async function saveSettings(s: Settings) {
  await db
    .insert(businessSettings)
    .values({ key: "shop", value: s })
    .onConflictDoUpdate({ target: businessSettings.key, set: { value: s, updatedAt: new Date() } });
}
