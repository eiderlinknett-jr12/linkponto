import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const controlDir = process.env.CONTROL_DATA_DIR || path.join(process.cwd(), "control-data");
fs.mkdirSync(controlDir, { recursive: true });

export const controlDb = new Database(path.join(controlDir, "control.sqlite"));
controlDb.pragma("journal_mode = WAL");
controlDb.pragma("foreign_keys = ON");

controlDb.exec(`
CREATE TABLE IF NOT EXISTS plans (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 code TEXT NOT NULL UNIQUE,
 price_cents INTEGER NOT NULL DEFAULT 0,
 billing_days INTEGER NOT NULL DEFAULT 30,
 grace_days INTEGER NOT NULL DEFAULT 3,
 employee_limit INTEGER,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tenants (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_name TEXT NOT NULL,
 document TEXT NOT NULL DEFAULT '',
 contact_name TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 slug TEXT NOT NULL UNIQUE,
 domain TEXT NOT NULL UNIQUE,
 plan_id INTEGER REFERENCES plans(id),
 status TEXT NOT NULL DEFAULT 'pending',
 paid_until TEXT,
 initial_admin_user TEXT NOT NULL DEFAULT 'admin',
 initial_admin_password TEXT,
 container_name TEXT,
 volume_name TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id INTEGER REFERENCES tenants(id),
 provider TEXT NOT NULL,
 external_id TEXT NOT NULL,
 event_id TEXT,
 status TEXT NOT NULL,
 amount_cents INTEGER,
 raw_event TEXT,
 occurred_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(provider, external_id, status)
);
CREATE TABLE IF NOT EXISTS provision_jobs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id INTEGER NOT NULL REFERENCES tenants(id),
 action TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued',
 attempts INTEGER NOT NULL DEFAULT 0,
 error TEXT,
 created_at TEXT NOT NULL,
 started_at TEXT,
 finished_at TEXT
);
`);

export type ControlSnapshot = {
  plans: Array<Record<string, unknown>>;
  tenants: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
};

export function requireControlPlane() {
  if (process.env.APP_ROLE !== "control") {
    throw new Error("Recurso disponível somente no painel central.");
  }
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function randomPassword() {
  return `${crypto.randomBytes(6).toString("base64url")}!Lp9`;
}

export function snapshot(): ControlSnapshot {
  requireControlPlane();
  return {
    plans: controlDb.prepare("SELECT * FROM plans ORDER BY active DESC,name").all() as Array<Record<string, unknown>>,
    tenants: controlDb.prepare(`
      SELECT t.*,p.name AS plan_name,p.code AS plan_code,p.grace_days
      FROM tenants t LEFT JOIN plans p ON p.id=t.plan_id
      ORDER BY t.id DESC
    `).all() as Array<Record<string, unknown>>,
    jobs: controlDb.prepare(`
      SELECT j.*,t.company_name,t.slug FROM provision_jobs j
      JOIN tenants t ON t.id=j.tenant_id ORDER BY j.id DESC LIMIT 40
    `).all() as Array<Record<string, unknown>>,
  };
}

export function enqueue(tenantId: number, action: "provision" | "suspend" | "activate" | "remove") {
  const now = new Date().toISOString();
  controlDb.prepare("INSERT INTO provision_jobs (tenant_id,action,status,created_at) VALUES (?,?,?,?)")
    .run(tenantId, action, "queued", now);
}

export function extendPaidUntil(current: string | null, days: number) {
  const now = new Date();
  const currentDate = current ? new Date(`${current}T12:00:00Z`) : now;
  const base = currentDate > now ? currentDate : now;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
