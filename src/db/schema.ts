import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
const money = (name: string) =>
  numeric(name, { precision: 10, scale: 2, mode: "number" });

/* ---------- Identity & access ---------- */

// "profiles" doubles as the role assignment table: exactly one role per account.
// Public registration can only ever create role = 'customer'.
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("customer"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    uniqueIndex("profiles_phone_key").on(t.phone),
    uniqueIndex("profiles_email_key").on(t.email),
    index("profiles_role_idx").on(t.role),
    check("profiles_role_check", sql`${t.role} in ('customer','admin','delivery')`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("sessions_token_key").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("password_resets_token_key").on(t.tokenHash)],
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Home"),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    landmark: text("landmark"),
    area: text("area"),
    city: text("city").notNull().default("Hyderabad"),
    state: text("state").notNull().default("Telangana"),
    pincode: text("pincode").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6, mode: "number" }),
    longitude: numeric("longitude", { precision: 9, scale: 6, mode: "number" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: ts("created_at"),
  },
  (t) => [
    index("addresses_user_idx").on(t.userId),
    check("addresses_pincode_check", sql`${t.pincode} ~ '^[0-9]{6}$'`),
  ],
);

/* ---------- Catalogue ---------- */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("categories_slug_key").on(t.slug)],
);

// Chicken is sold by weight. `pricePerKg` is the source of truth; a pack's price
// is derived from the chosen grams, so any custom weight is priced consistently.
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url").notNull().default("/images/whole.jpg"),
    pricePerKg: money("price_per_kg").notNull(),
    mrpPerKg: money("mrp_per_kg").notNull(),
    minGrams: integer("min_grams").notNull().default(250),
    stepGrams: integer("step_grams").notNull().default(50),
    maxGrams: integer("max_grams").notNull().default(5000),
    allowCustomWeight: boolean("allow_custom_weight").notNull().default(true),
    pieceInfo: text("piece_info"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    index("products_category_idx").on(t.categoryId),
    check("products_price_check", sql`${t.pricePerKg} > 0 and ${t.mrpPerKg} >= ${t.pricePerKg}`),
    check("products_weight_check", sql`${t.minGrams} > 0 and ${t.stepGrams} > 0 and ${t.maxGrams} >= ${t.minGrams}`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    grams: integer("grams").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("product_variants_product_grams_key").on(t.productId, t.grams),
    check("product_variants_grams_check", sql`${t.grams} > 0`),
  ],
);

// Stock is tracked in grams per product so every pack size draws from one pool.
export const inventory = pgTable(
  "inventory",
  {
    productId: uuid("product_id").primaryKey().references(() => products.id, { onDelete: "cascade" }),
    stockGrams: integer("stock_grams").notNull().default(0),
    lowStockGrams: integer("low_stock_grams").notNull().default(5000),
    updatedAt: ts("updated_at"),
  },
  (t) => [check("inventory_stock_check", sql`${t.stockGrams} >= 0`)],
);

/* ---------- Delivery configuration ---------- */

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pincode: text("pincode").notNull(),
    areaName: text("area_name").notNull(),
    deliveryFee: money("delivery_fee"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("delivery_zones_pincode_key").on(t.pincode),
    check("delivery_zones_pincode_check", sql`${t.pincode} ~ '^[0-9]{6}$'`),
  ],
);

export const deliverySlots = pgTable(
  "delivery_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    capacity: integer("capacity").notNull().default(30),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at"),
  },
  (t) => [check("delivery_slots_capacity_check", sql`${t.capacity} > 0`)],
);

/* ---------- Coupons ---------- */

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    type: text("type").notNull(),
    value: money("value").notNull(),
    minOrder: money("min_order").notNull().default(0),
    maxDiscount: money("max_discount"),
    usageLimit: integer("usage_limit"),
    perUserLimit: integer("per_user_limit").notNull().default(1),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("coupons_code_key").on(t.code),
    check("coupons_type_check", sql`${t.type} in ('percent','flat')`),
    check("coupons_value_check", sql`${t.value} > 0`),
  ],
);

/* ---------- Orders ---------- */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("placed"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"),
    refundStatus: text("refund_status").notNull().default("none"),
    subtotal: money("subtotal").notNull(),
    discount: money("discount").notNull().default(0),
    deliveryFee: money("delivery_fee").notNull().default(0),
    tax: money("tax").notNull().default(0),
    total: money("total").notNull(),
    couponCode: text("coupon_code"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    address: jsonb("address").$type<OrderAddress>().notNull(),
    deliveryDate: date("delivery_date", { mode: "string" }).notNull(),
    slotId: uuid("slot_id").references(() => deliverySlots.id, { onDelete: "set null" }),
    slotLabel: text("slot_label").notNull(),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key"),
    cancelReason: text("cancel_reason"),
    cancelledBy: uuid("cancelled_by"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    uniqueIndex("orders_number_key").on(t.orderNumber),
    uniqueIndex("orders_user_idem_key").on(t.userId, t.idempotencyKey),
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_slot_idx").on(t.deliveryDate, t.slotId),
    check(
      "orders_status_check",
      sql`${t.status} in ('placed','payment_confirmed','accepted','preparing','ready_for_dispatch','out_for_delivery','delivered','cancelled')`,
    ),
    check("orders_method_check", sql`${t.paymentMethod} in ('online','cod')`),
    check("orders_payment_status_check", sql`${t.paymentStatus} in ('pending','paid','failed','refunded')`),
    check("orders_refund_status_check", sql`${t.refundStatus} in ('none','initiated','completed')`),
    check("orders_total_check", sql`${t.total} >= 0 and ${t.subtotal} >= 0`),
  ],
);

export type OrderAddress = {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
};

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    grams: integer("grams").notNull(),
    quantity: integer("quantity").notNull(),
    pricePerKg: money("price_per_kg").notNull(),
    unitPrice: money("unit_price").notNull(),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("order_items_qty_check", sql`${t.quantity} > 0 and ${t.grams} > 0`),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    actorId: uuid("actor_id"),
    createdAt: ts("created_at"),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId, t.createdAt)],
);

/* ---------- Payments ---------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    amount: money("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("created"),
    method: text("method"),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    failureReason: text("failure_reason"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    uniqueIndex("payments_provider_payment_key").on(t.providerPaymentId),
    index("payments_provider_order_idx").on(t.providerOrderId),
    check("payments_provider_check", sql`${t.provider} in ('razorpay','demo','cod')`),
    check("payments_status_check", sql`${t.status} in ('created','captured','failed','refunded')`),
  ],
);

// Deduplicates provider webhooks so the same event is never processed twice.
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: ts("received_at"),
});

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    amount: money("amount").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("initiated"),
    providerRefundId: text("provider_refund_id"),
    createdBy: uuid("created_by"),
    createdAt: ts("created_at"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("refunds_order_idx").on(t.orderId),
    check("refunds_amount_check", sql`${t.amount} > 0`),
    check("refunds_status_check", sql`${t.status} in ('initiated','processed','failed')`),
  ],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    discount: money("discount").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("coupon_redemptions_order_key").on(t.orderId),
    index("coupon_redemptions_coupon_user_idx").on(t.couponId, t.userId),
  ],
);

/* ---------- Delivery staff ---------- */

export const deliveryStaff = pgTable("delivery_staff", {
  profileId: uuid("profile_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  employeeCode: text("employee_code").notNull(),
  vehicleNumber: text("vehicle_number"),
  joinedAt: ts("joined_at"),
});

export const deliveryAssignments = pgTable(
  "delivery_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by"),
    status: text("status").notNull().default("assigned"),
    failureReason: text("failure_reason"),
    assignedAt: ts("assigned_at"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("delivery_assignments_staff_idx").on(t.staffId, t.status),
    index("delivery_assignments_order_idx").on(t.orderId),
    // At most one live assignment per order.
    uniqueIndex("delivery_assignments_one_active_key")
      .on(t.orderId)
      .where(sql`${t.status} in ('assigned','accepted','out_for_delivery')`),
    check(
      "delivery_assignments_status_check",
      sql`${t.status} in ('assigned','accepted','out_for_delivery','delivered','failed','reassigned','cancelled')`,
    ),
  ],
);

export const deliveryStatusHistory = pgTable(
  "delivery_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id").references(() => deliveryAssignments.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    actorId: uuid("actor_id"),
    createdAt: ts("created_at"),
  },
  (t) => [index("delivery_status_history_order_idx").on(t.orderId, t.createdAt)],
);

/* ---------- Notifications & settings ---------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: ts("created_at"),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const businessSettings = pgTable("business_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at"),
});
