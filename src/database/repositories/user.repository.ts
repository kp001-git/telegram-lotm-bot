import { getDatabaseClient } from "../client";
import { calculateSequenceLevel } from "../../utils/sequences";

export type BeyonderRole =
  | "CELESTIAL_WORTHY"
  | "THE_FOOL"
  | "THE_WORLD"
  | "THE_STAR"
  | "BEYONDER";

export interface DbUser {
  chat_id?: number;
  user_id: number;
  username: string | null;
  first_name: string;
  role: BeyonderRole;
  pathway: string | null;
  sequence_level: number;
  spirituality_xp?: number;
  custom_position?: string | null;
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
   * Single-statement upsert to optimize for Turso free tier quota (global/private users).
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

  /**
   * Upsert a member record scoped to a specific group (chat_id, user_id).
   * Also keeps the global users table populated.
   */
  async upsertMember(
    chatId: number,
    userId: number,
    username: string | null,
    firstName: string,
    initialRole: BeyonderRole = "BEYONDER",
    incrementBy: number = 1,
    xpGain: number = 0
  ): Promise<void> {
    const now = new Date().toISOString();
    const initialSeq = calculateSequenceLevel(xpGain);
    const statements: any[] = [
      {
        sql: `
          INSERT INTO group_members (
            chat_id, user_id, username, first_name, role, pathway, sequence_level, spirituality_xp, prayers_count, messages_count, joined_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?, ?)
          ON CONFLICT(chat_id, user_id) DO UPDATE SET
            username = excluded.username,
            first_name = excluded.first_name,
            messages_count = group_members.messages_count + ?,
            spirituality_xp = COALESCE(group_members.spirituality_xp, 0) + ?,
            sequence_level = CASE
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 9000 THEN 0
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 6000 THEN 1
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 4200 THEN 2
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 2800 THEN 3
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 1800 THEN 4
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 1100 THEN 5
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 600 THEN 6
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 300 THEN 7
              WHEN COALESCE(group_members.spirituality_xp, 0) + ? >= 100 THEN 8
              ELSE 9
            END,
            updated_at = excluded.updated_at;
        `,
        args: [
          chatId,
          userId,
          username,
          firstName,
          initialRole,
          initialSeq,
          xpGain,
          incrementBy,
          now,
          now,
          incrementBy,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
        ],
      },
      {
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
      },
    ];
    await this.client.batch(statements, "write");
  }

  async getMember(chatId: number, userId: number): Promise<DbUser | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM group_members WHERE chat_id = ? AND user_id = ? LIMIT 1;`,
      args: [chatId, userId],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as DbUser;
  }

  async getMemberByUsername(chatId: number, username: string): Promise<DbUser | null> {
    const clean = username.startsWith("@") ? username.slice(1) : username;
    const result = await this.client.execute({
      sql: `SELECT * FROM group_members WHERE chat_id = ? AND LOWER(username) = LOWER(?) LIMIT 1;`,
      args: [chatId, clean],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as DbUser;
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

  async setMemberRole(chatId: number, userId: number, role: BeyonderRole): Promise<void> {
    const now = new Date().toISOString();
    // Ensure member exists in group_members, then update role
    await this.client.batch(
      [
        {
          sql: `
            INSERT INTO group_members (
              chat_id, user_id, username, first_name, role, pathway, sequence_level, prayers_count, messages_count, joined_at, updated_at
            ) VALUES (?, ?, NULL, 'Beyonder', ?, NULL, 9, 0, 0, ?, ?)
            ON CONFLICT(chat_id, user_id) DO UPDATE SET
              role = excluded.role,
              updated_at = excluded.updated_at;
          `,
          args: [chatId, userId, role, now, now],
        },
        {
          sql: `
            INSERT INTO users (
              user_id, username, first_name, role, pathway, sequence_level, prayers_count, messages_count, joined_at, updated_at
            ) VALUES (?, NULL, 'Beyonder', ?, NULL, 9, 0, 0, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              updated_at = excluded.updated_at;
          `,
          args: [userId, role, now, now],
        },
      ],
      "write"
    );
  }

  async setUserPathway(userId: number, pathwayName: string, chatId?: number): Promise<void> {
    const now = new Date().toISOString();
    const statements: any[] = [
      {
        sql: `UPDATE users SET pathway = ?, updated_at = ? WHERE user_id = ?;`,
        args: [pathwayName, now, userId],
      },
    ];

    if (chatId) {
      statements.push({
        sql: `UPDATE group_members SET pathway = ?, updated_at = ? WHERE chat_id = ? AND user_id = ?;`,
        args: [pathwayName, now, chatId, userId],
      });
    }

    await this.client.batch(statements, "write");
  }

  async incrementPrayers(userId: number, chatId?: number, xpGain: number = 0): Promise<number> {
    const now = new Date().toISOString();
    let newCount = 1;

    if (chatId) {
      const res = await this.client.execute({
        sql: `
          UPDATE group_members 
          SET 
            prayers_count = prayers_count + 1,
            spirituality_xp = COALESCE(spirituality_xp, 0) + ?,
            sequence_level = CASE
              WHEN COALESCE(spirituality_xp, 0) + ? >= 9000 THEN 0
              WHEN COALESCE(spirituality_xp, 0) + ? >= 6000 THEN 1
              WHEN COALESCE(spirituality_xp, 0) + ? >= 4200 THEN 2
              WHEN COALESCE(spirituality_xp, 0) + ? >= 2800 THEN 3
              WHEN COALESCE(spirituality_xp, 0) + ? >= 1800 THEN 4
              WHEN COALESCE(spirituality_xp, 0) + ? >= 1100 THEN 5
              WHEN COALESCE(spirituality_xp, 0) + ? >= 600 THEN 6
              WHEN COALESCE(spirituality_xp, 0) + ? >= 300 THEN 7
              WHEN COALESCE(spirituality_xp, 0) + ? >= 100 THEN 8
              ELSE 9
            END,
            updated_at = ? 
          WHERE chat_id = ? AND user_id = ?
          RETURNING prayers_count;
        `,
        args: [
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          xpGain,
          now,
          chatId,
          userId,
        ],
      });
      if (res.rows.length > 0) {
        newCount = Number(res.rows[0].prayers_count);
      }
    }

    // Also sync global prayers count
    const globalRes = await this.client.execute({
      sql: `
        UPDATE users 
        SET prayers_count = prayers_count + 1, updated_at = ? 
        WHERE user_id = ?
        RETURNING prayers_count;
      `,
      args: [now, userId],
    });

    if (!chatId && globalRes.rows.length > 0) {
      newCount = Number(globalRes.rows[0].prayers_count);
    }

    return newCount;
  }

  async getGroupLeaderboard(chatId: number, limit = 10): Promise<DbUser[]> {
    const res = await this.client.execute({
      sql: `
        SELECT * FROM group_members
        WHERE chat_id = ?
        ORDER BY sequence_level ASC, COALESCE(spirituality_xp, 0) DESC, messages_count DESC
        LIMIT ?;
      `,
      args: [chatId, limit],
    });

    return res.rows as unknown as DbUser[];
  }

  async setMemberPosition(chatId: number, userId: number, position: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO group_members (
          chat_id, user_id, username, first_name, role, pathway, sequence_level, spirituality_xp, custom_position, prayers_count, messages_count, joined_at, updated_at
        ) VALUES (?, ?, NULL, 'Beyonder', 'BEYONDER', NULL, 9, 0, ?, 0, 0, ?, ?)
        ON CONFLICT(chat_id, user_id) DO UPDATE SET
          custom_position = excluded.custom_position,
          updated_at = excluded.updated_at;
      `,
      args: [chatId, userId, position, now, now],
    });
  }

  async getCouncilMembers(chatId?: number): Promise<DbUser[]> {
    if (chatId) {
      const result = await this.client.execute({
        sql: `
          SELECT * FROM group_members 
          WHERE chat_id = ? AND role IN ('CELESTIAL_WORTHY', 'THE_FOOL', 'THE_WORLD', 'THE_STAR')
          ORDER BY 
            CASE role
              WHEN 'CELESTIAL_WORTHY' THEN 1
              WHEN 'THE_FOOL' THEN 2
              WHEN 'THE_WORLD' THEN 3
              WHEN 'THE_STAR' THEN 4
              ELSE 5
            END ASC;
        `,
        args: [chatId],
      });
      return result.rows as unknown as DbUser[];
    }

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
   * Aggregate statistics query for /fate_records scoped strictly to chatId.
   */
  async getFateRecords(chatId: number): Promise<FateRecords> {
    // 1. Overall stats strictly for this group
    const statsResult = await this.client.execute({
      sql: `
        SELECT 
          COUNT(*) as total_beyonders,
          SUM(CASE WHEN role IN ('CELESTIAL_WORTHY', 'THE_FOOL', 'THE_WORLD', 'THE_STAR') THEN 1 ELSE 0 END) as council_count,
          COALESCE(SUM(messages_count), 0) as total_messages,
          COALESCE(SUM(prayers_count), 0) as total_prayers
        FROM group_members
        WHERE chat_id = ?;
      `,
      args: [chatId],
    });

    const row = statsResult.rows[0] || {};
    let totalBeyonders = Number(row.total_beyonders || 0);
    let councilCount = Number(row.council_count || 0);
    let totalMessages = Number(row.total_messages || 0);
    let totalPrayers = Number(row.total_prayers || 0);

    // If group has no members tracked yet in group_members, fallback to users table
    const useGroupMembers = totalBeyonders > 0;
    if (!useGroupMembers) {
      const fallbackResult = await this.client.execute({
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
      const fbRow = fallbackResult.rows[0] || {};
      totalBeyonders = Number(fbRow.total_beyonders || 0);
      councilCount = Number(fbRow.council_count || 0);
      totalMessages = Number(fbRow.total_messages || 0);
      totalPrayers = Number(fbRow.total_prayers || 0);
    }

    // 2. Top 3 active Beyonders
    const topResult = await this.client.execute({
      sql: useGroupMembers
        ? `SELECT * FROM group_members WHERE chat_id = ? ORDER BY messages_count DESC LIMIT 3;`
        : `SELECT * FROM users ORDER BY messages_count DESC LIMIT 3;`,
      args: useGroupMembers ? [chatId] : [],
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
