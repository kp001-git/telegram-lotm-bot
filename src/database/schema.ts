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
      spirituality_xp INTEGER DEFAULT 0,
      custom_position TEXT,
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
      welcome_enabled INTEGER DEFAULT 1,
      goodbye_enabled INTEGER DEFAULT 1,
      goodbye_template TEXT,
      is_sealed INTEGER DEFAULT 0,
      log_chat_id TEXT,
      warn_limit INTEGER DEFAULT 3,
      warn_punishment TEXT DEFAULT 'SILENCE',
      ward_enabled INTEGER DEFAULT 0,
      ward_whitelist TEXT DEFAULT 't.me,telegram.org'
    );`,
    `CREATE TABLE IF NOT EXISTS member_corruptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      issued_by INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS group_whispers (
      chat_id INTEGER NOT NULL,
      trigger_word TEXT NOT NULL,
      response_type TEXT NOT NULL,
      text_content TEXT,
      file_id TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT,
      PRIMARY KEY (chat_id, trigger_word)
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
    `CREATE INDEX IF NOT EXISTS idx_corruptions_chat_user ON member_corruptions(chat_id, user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_polls_chat_status ON polls(chat_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);`
  ];

  await client.batch(statements, "write");

  // Safe migrations for existing installations
  const safeMigrations = [
    "ALTER TABLE suggestions ADD COLUMN chat_id INTEGER;",
    "ALTER TABLE group_settings ADD COLUMN warn_limit INTEGER DEFAULT 3;",
    "ALTER TABLE group_settings ADD COLUMN warn_punishment TEXT DEFAULT 'SILENCE';",
    "ALTER TABLE group_settings ADD COLUMN ward_enabled INTEGER DEFAULT 0;",
    "ALTER TABLE group_settings ADD COLUMN ward_whitelist TEXT DEFAULT 't.me,telegram.org';",
    "ALTER TABLE group_settings ADD COLUMN welcome_enabled INTEGER DEFAULT 1;",
    "ALTER TABLE group_settings ADD COLUMN goodbye_enabled INTEGER DEFAULT 1;",
    "ALTER TABLE group_settings ADD COLUMN goodbye_template TEXT;",
    "ALTER TABLE group_members ADD COLUMN spirituality_xp INTEGER DEFAULT 0;",
    "ALTER TABLE group_members ADD COLUMN custom_position TEXT;",
  ];

  for (const sql of safeMigrations) {
    try {
      await client.execute(sql);
    } catch {
      // Column already present or table created fresh with column
    }
  }

  // Create indexes on migrated columns after they are guaranteed to exist
  const postMigrationIndexes = [
    "CREATE INDEX IF NOT EXISTS idx_suggestions_chat ON suggestions(chat_id);",
    "CREATE INDEX IF NOT EXISTS idx_group_members_xp ON group_members(chat_id, sequence_level, spirituality_xp);",
  ];
  for (const idxSql of postMigrationIndexes) {
    try {
      await client.execute(idxSql);
    } catch {
      // Ignore index creation error
    }
  }
}
