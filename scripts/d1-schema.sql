-- Cloudflare D1 初始建表（Pages 绑定 NOTESD 前执行）
-- 也可依赖 shared/d1-migrate.js 在首次 API 访问时自动迁移

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY, title TEXT, content TEXT, tags TEXT,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY, level TEXT, message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours'))
);
CREATE TABLE IF NOT EXISTS order_data (
  key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours'))
);

CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs(created_at);

CREATE TABLE IF NOT EXISTS note_shares (
  token TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
