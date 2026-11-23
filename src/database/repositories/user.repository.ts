import { getDatabaseClient } from "../client";

export type BeyonderRole =
  | "CELESTIAL_WORTHY"
  | "THE_FOOL"
  | "THE_WORLD"
  | "THE_STAR"
  | "BEYONDER";

export interface DbUser {
  user_id: number;
  username: string | null;
  first_name: string;
  role: BeyonderRole;
  pathway: string | null;
  sequence_level: number;
  prayers_count: number;
  messages_count: number;
  joined_at: string;
  updated_at: string;
}

export interface FateRecords {
  totalBeyonders: number;
  councilCount: number;
  standardBeyonders: number;
  totalMessages: number;
  totalPrayers: number;
  topBeyonders: DbUser[];
  totalDecrees: number;
}

export class UserRepository {
  private client = getDatabaseClient();

  /**
   * Single-statement upsert to optimize for Turso free tier quota.
   * If user doesn't exist, inserts with default role and count = 1.
   * If user exists, updates username/first_name, increments message count by incrementBy, and refreshes timestamp.
   * Preserves existing role, pathway, sequence level, and prayers.
   */
  async upsertUser(
    userId: number,
    username: string | null,
    firstName: string,
    initialRole: BeyonderRole = "BEYONDER",
    incrementBy: number = 1
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO users (
          user_id, username, first_name, role, pathway, sequence_level, prayers_count, messages_count, joined_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, 9, 0, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          username = excluded.username,
          first_name = excluded.first_name,
          messages_count = users.messages_count + ?,
          updated_at = excluded.updated_at;
      `,
      args: [userId, username, firstName, initialRole, incrementBy, now, now, incrementBy],
    });
  }

  async getUserById(userId: number): Promise<DbUser | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM users WHERE user_id = ? LIMIT 1;`,
      args: [userId],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as DbUser;
  }

  async getUserByUsername(username: string): Promise<DbUser | null> {
    const clean = username.startsWith("@") ? username.slice(1) : username;
    const result = await this.client.execute({
      sql: `SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1;`,
      args: [clean],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as DbUser;
  }

  async setRole(userId: number, role: BeyonderRole): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `UPDATE users SET role = ?, updated_at = ? WHERE user_id = ?;`,
      args: [role, now, userId],
    });
  }

  async setUserPathway(userId: number, pathwayName: string): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `UPDATE users SET pathway = ?, updated_at = ? WHERE user_id = ?;`,
      args: [pathwayName, now, userId],
    });
  }

  async incrementPrayers(userId: number): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.client.execute({
      sql: `
        UPDATE users 
        SET prayers_count = prayers_count + 1, updated_at = ? 
        WHERE user_id = ?
        RETURNING prayers_count;
      `,
      args: [now, userId],
    });

    if (result.rows.length === 0) return 1;
    return Number(result.rows[0].prayers_count);
  }

  async getCouncilMembers(): Promise<DbUser[]> {
    const result = await this.client.execute({
      sql: `
        SELECT * FROM users 
        WHERE role IN ('CELESTIAL_WORTHY', 'THE_FOOL', 'THE_WORLD', 'THE_STAR')
        ORDER BY 
          CASE role
            WHEN 'CELESTIAL_WORTHY' THEN 1
            WHEN 'THE_FOOL' THEN 2
            WHEN 'THE_WORLD' THEN 3
            WHEN 'THE_STAR' THEN 4
            ELSE 5
          END ASC;
      `,
      args: [],
    });

    return result.rows as unknown as DbUser[];
  }

  async getOwner(): Promise<DbUser | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM users WHERE role = 'CELESTIAL_WORTHY' LIMIT 1;`,
      args: [],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as DbUser;
  }

  /**
   * Aggregate statistics query for /fate_records
   * Uses minimal Turso queries to return complete activity and council metrics.
   */
  async getFateRecords(chatId: number): Promise<FateRecords> {
    // 1. Overall stats
    const statsResult = await this.client.execute({
      sql: `
        SELECT 
          COUNT(*) as total_beyonders,
          SUM(CASE WHEN role IN ('CELESTIAL_WORTHY', 'THE_FOOL', 'THE_WORLD', 'THE_STAR') THEN 1 ELSE 0 END) as council_count,
          COALESCE(SUM(messages_count), 0) as total_messages,
          COALESCE(SUM(prayers_count), 0) as total_prayers
        FROM users;
      `,
      args: [],
    });

    const row = statsResult.rows[0] || {};
    const totalBeyonders = Number(row.total_beyonders || 0);
    const councilCount = Number(row.council_count || 0);
    const totalMessages = Number(row.total_messages || 0);
    const totalPrayers = Number(row.total_prayers || 0);

    // 2. Top 3 active Beyonders
    const topResult = await this.client.execute({
      sql: `
        SELECT * FROM users
        ORDER BY messages_count DESC
        LIMIT 3;
      `,
      args: [],
    });
    const topBeyonders = topResult.rows as unknown as DbUser[];

    // 3. Moderation decrees in this chat
    const decreesResult = await this.client.execute({
      sql: `SELECT COUNT(*) as total_decrees FROM audit_logs WHERE chat_id = ?;`,
      args: [chatId],
    });
    const totalDecrees = Number(decreesResult.rows[0]?.total_decrees || 0);

    return {
      totalBeyonders,
      councilCount,
      standardBeyonders: Math.max(0, totalBeyonders - councilCount),
      totalMessages,
      totalPrayers,
      topBeyonders,
      totalDecrees,
    };
  }
}

export const userRepository = new UserRepository();
