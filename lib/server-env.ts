import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./password";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const uploadsDir = path.join(dataDir, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const sqlite = new Database(path.join(dataDir, "linkponto.sqlite"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS employees (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, cpf TEXT NOT NULL UNIQUE,
 code TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL, role TEXT NOT NULL,
 department TEXT NOT NULL DEFAULT 'Geral', workdays TEXT NOT NULL DEFAULT 'Seg a Sex',
 start_time TEXT NOT NULL DEFAULT '08:00', break_start TEXT NOT NULL DEFAULT '12:00',
 break_end TEXT NOT NULL DEFAULT '13:00', end_time TEXT NOT NULL DEFAULT '17:00',
 weekly_minutes INTEGER NOT NULL DEFAULT 2640, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS punches (
 id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id),
 kind TEXT NOT NULL, local_date TEXT NOT NULL, occurred_at TEXT NOT NULL,
 source TEXT NOT NULL DEFAULT 'totem', latitude TEXT, longitude TEXT, device TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS adjustments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id),
 punch_date TEXT NOT NULL, requested_time TEXT NOT NULL, reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS company_settings (
 id INTEGER PRIMARY KEY, legal_name TEXT NOT NULL DEFAULT '', trade_name TEXT NOT NULL DEFAULT '',
 document TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
 timezone TEXT NOT NULL DEFAULT 'America/Fortaleza', tolerance_minutes INTEGER NOT NULL DEFAULT 10,
 latitude TEXT, longitude TEXT, allowed_radius_meters INTEGER NOT NULL DEFAULT 150,
 require_location INTEGER NOT NULL DEFAULT 1, logo_key TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'employee', employee_id INTEGER REFERENCES employees(id),
 status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manual_day_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id),
 local_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'worked', note TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(employee_id,local_date)
);
CREATE TABLE IF NOT EXISTS manual_entry_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, local_date TEXT NOT NULL,
 action TEXT NOT NULL, snapshot TEXT NOT NULL, performed_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS punch_edit_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, punch_id INTEGER NOT NULL, employee_id INTEGER NOT NULL,
 old_occurred_at TEXT NOT NULL, new_occurred_at TEXT NOT NULL, reason TEXT NOT NULL,
 performed_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS day_off_swaps (
 id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id),
 original_off_date TEXT NOT NULL, replacement_off_date TEXT NOT NULL, reason TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(employee_id,original_off_date,replacement_off_date)
);
`);
const employeeColumns = sqlite
  .prepare("PRAGMA table_info(employees)")
  .all() as Array<{ name: string }>;
if (!employeeColumns.some((c) => c.name === "schedule_json"))
  sqlite.exec("ALTER TABLE employees ADD COLUMN schedule_json TEXT");
if (!employeeColumns.some((c) => c.name === "calculation_start_date")) {
  sqlite.exec("ALTER TABLE employees ADD COLUMN calculation_start_date TEXT");
  sqlite.exec(
    "UPDATE employees SET calculation_start_date=substr(created_at,1,10) WHERE calculation_start_date IS NULL",
  );
}
const adjustmentColumns = sqlite
  .prepare("PRAGMA table_info(adjustments)")
  .all() as Array<{ name: string }>;
if (!adjustmentColumns.some((c) => c.name === "requested_kind"))
  sqlite.exec("ALTER TABLE adjustments ADD COLUMN requested_kind TEXT");
const now = new Date().toISOString();
const initialAdminPassword = process.env.ADMIN_PASSWORD;
if (initialAdminPassword)
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO users (name,username,password_hash,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      "Administrador",
      "admin",
      hashPassword(initialAdminPassword),
      "admin",
      "active",
      now,
      now,
    );

class Statement {
  private params: unknown[] = [];
  constructor(private sql: string) {}
  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }
  first<T>() {
    return sqlite.prepare(this.sql).get(...this.params) as T | null;
  }
  all<T>() {
    return { results: sqlite.prepare(this.sql).all(...this.params) as T[] };
  }
  run() {
    return sqlite.prepare(this.sql).run(...this.params);
  }
}

const DB = {
  prepare(sql: string) {
    return new Statement(sql);
  },
};
const BUCKET = {
  async get(key: string) {
    const filePath = path.join(uploadsDir, path.basename(key));
    if (!fs.existsSync(filePath)) return null;
    return {
      body: fs.readFileSync(filePath),
      httpMetadata: {
        contentType: key.endsWith(".webp")
          ? "image/webp"
          : key.endsWith(".jpg") || key.endsWith(".jpeg")
            ? "image/jpeg"
            : "image/png",
      },
    };
  },
  async put(key: string, data: ArrayBuffer | Uint8Array) {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    fs.writeFileSync(path.join(uploadsDir, path.basename(key)), bytes);
  },
};

export const serverEnv = { DB, BUCKET };
