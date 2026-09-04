import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
`);

class Statement {
  private params: unknown[] = [];
  constructor(private sql: string) {}
  bind(...params: unknown[]) { this.params = params; return this; }
  first<T>() { return sqlite.prepare(this.sql).get(...this.params) as T | null; }
  all<T>() { return { results: sqlite.prepare(this.sql).all(...this.params) as T[] }; }
  run() { return sqlite.prepare(this.sql).run(...this.params); }
}

const DB = { prepare(sql: string) { return new Statement(sql); } };
const BUCKET = {
  async get(key: string) {
    const filePath = path.join(uploadsDir, path.basename(key));
    if (!fs.existsSync(filePath)) return null;
    return { body: fs.readFileSync(filePath), httpMetadata: { contentType: key.endsWith(".webp") ? "image/webp" : key.endsWith(".jpg") || key.endsWith(".jpeg") ? "image/jpeg" : "image/png" } };
  },
  async put(key: string, data: ArrayBuffer | Uint8Array) {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    fs.writeFileSync(path.join(uploadsDir, path.basename(key)), bytes);
  },
};

export const serverEnv = { DB, BUCKET };
