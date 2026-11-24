import { Client } from "@libsql/client";
import { getDatabaseClient } from "./client";

export async function initSchema(client: Client = getDatabaseClient()): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      role TEXT DEFAULT 'BEYONDER',
      pathway TEXT,
      sequence_level INTEGER DEFAULT 9,
      prayers_count INTEGER DEFAULT 0,
      messages_count INTEGER DEFAULT 0,
      joined_at TEXT,
      updated_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS group_members (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT,
      first_name TEXT,
      role TEXT DEFAULT 'BEYONDER',
      pathway TEXT,
      sequence_level INTEGER DEFAULT 9,
      prayers_count INTEGER DEFAULT 0,
      messages_count INTEGER DEFAULT 0,
      joined_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (chat_id, user_id)
    );`,
    `CREATE TABLE IF NOT EXISTS group_settings (
      chat_id INTEGER PRIMARY KEY,
      sacred_laws TEXT,
      lore_text TEXT,
      welcome_template TEXT,
      is_sealed INTEGER DEFAULT 0,
      log_chat_id TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      actor_id INTEGER,
      target_id INTEGER,
      action TEXT,
      reason TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      user_id INTEGER,
      type TEXT,
      content TEXT,
      status TEXT DEFAULT 'PENDING',
      reviewed_by INTEGER,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      suggestion_id INTEGER,
      question TEXT,
      options_json TEXT,
      status TEXT DEFAULT 'OPEN',
      created_by INTEGER,
      message_id INTEGER,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS poll_votes (
      poll_id INTEGER,
      user_id INTEGER,
      option_index INTEGER,
      voted_at TEXT,
      PRIMARY KEY (poll_id, user_id)
    );`,
    `CREATE TABLE IF NOT EXISTS authorized_chats (
      chat_id INTEGER PRIMARY KEY,
      title TEXT,
      approved_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
    `CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(chat_id, role);`,
    `CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_chat ON audit_logs(chat_id);`,
    `CREATE INDEX IF NOT EXISTS idx_polls_chat_status ON polls(chat_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);`
  ];

  await client.batch(statements, "write");

  // Safe migration for existing installations where suggestions table lacked chat_id
  try {
    await client.execute("ALTER TABLE suggestions ADD COLUMN chat_id INTEGER;");
  } catch {
    // Column already present or table created fresh with column
  }

  // Create index on suggestions(chat_id) after column is guaranteed to exist
  try {
    await client.execute("CREATE INDEX IF NOT EXISTS idx_suggestions_chat ON suggestions(chat_id);");
  } catch {
    // Ignore index creation error
  }
}
