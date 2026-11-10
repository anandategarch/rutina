-- Rutina 0002: tabel yang semula hanya dibuat lazy oleh ensureSchema().
-- Menyamakan migrations/ dengan src/lib/server/schema.ts supaya lingkungan
-- baru yang hanya menjalankan SQL mendapat struktur lengkap.

CREATE TABLE IF NOT EXISTS habit_metadata (
  habit_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habit_daily_progress (
  habit_id TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (habit_id, activity_date)
);

CREATE TABLE IF NOT EXISTS transaction_metadata (
  transaction_id TEXT PRIMARY KEY,
  wallet_id TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  split_group_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_modules (
  module_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#78716c',
  type TEXT NOT NULL DEFAULT 'expense',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (type IN ('expense', 'income'))
);

CREATE INDEX IF NOT EXISTS idx_finance_categories_sort ON finance_categories(sort_order, name);
