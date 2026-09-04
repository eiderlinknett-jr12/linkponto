import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  cpf: text("cpf").notNull().unique(),
  code: text("code").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull().default("Geral"),
  workdays: text("workdays").notNull().default("Seg a Sex"),
  startTime: text("start_time").notNull().default("08:00"),
  breakStart: text("break_start").notNull().default("12:00"),
  breakEnd: text("break_end").notNull().default("13:00"),
  endTime: text("end_time").notNull().default("17:00"),
  weeklyMinutes: integer("weekly_minutes").notNull().default(2640),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
});

export const punches = sqliteTable("punches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  kind: text("kind").notNull(),
  localDate: text("local_date").notNull(),
  occurredAt: text("occurred_at").notNull(),
  source: text("source").notNull().default("totem"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  device: text("device"),
  createdAt: text("created_at").notNull(),
});

export const adjustments = sqliteTable("adjustments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  punchDate: text("punch_date").notNull(),
  requestedTime: text("requested_time").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

export const companySettings = sqliteTable("company_settings", {
  id: integer("id").primaryKey(),
  legalName: text("legal_name").notNull().default(""),
  tradeName: text("trade_name").notNull().default(""),
  document: text("document").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  timezone: text("timezone").notNull().default("America/Fortaleza"),
  toleranceMinutes: integer("tolerance_minutes").notNull().default(10),
  latitude: text("latitude"),
  longitude: text("longitude"),
  allowedRadiusMeters: integer("allowed_radius_meters").notNull().default(150),
  requireLocation: integer("require_location", { mode: "boolean" }).notNull().default(true),
  logoKey: text("logo_key"),
  updatedAt: text("updated_at").notNull(),
});
