import { getDatabaseClient } from "../client";

export interface AuthorizedChat {
  chat_id: number;
  title: string | null;
  approved_at: string;
}

export class SanctuaryRepository {
  private client = getDatabaseClient();

  // In-memory Set cache for authorized chat IDs
  private authorizedSet = new Set<number>();
  // Timestamp when each chat was last checked (5-minute TTL)
  private checkedTimestamps = new Map<number, number>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Checks if a chat_id is whitelisted to use @greyfogbot.
   * Checks in-memory cache first; on cache miss or TTL expiration, queries Turso.
   */
  async isChatAuthorized(chatId: number): Promise<boolean> {
    const now = Date.now();
    const expiry = this.checkedTimestamps.get(chatId);

    // Cache hit and within 5-minute TTL
    if (expiry && now < expiry) {
      return this.authorizedSet.has(chatId);
    }

    // Cache miss / TTL expired -> Query Turso
    try {
      const result = await this.client.execute({
        sql: `SELECT 1 FROM authorized_chats WHERE chat_id = ? LIMIT 1;`,
        args: [chatId],
      });

      const isAuthorized = result.rows.length > 0;

      if (isAuthorized) {
        this.authorizedSet.add(chatId);
      } else {
        this.authorizedSet.delete(chatId);
      }

      this.checkedTimestamps.set(chatId, now + this.TTL_MS);
      return isAuthorized;
    } catch (err) {
      console.error(`[sanctuaryRepository] Error checking authorization for ${chatId}:`, err);
      // Fall back to memory cache if Turso is temporarily unreachable
      return this.authorizedSet.has(chatId);
    }
  }

  /**
   * Authorizes a chat directly in the database (used for testing / manual Turso operations).
   */
  async authorizeChat(chatId: number, title?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO authorized_chats (chat_id, title, approved_at)
        VALUES (?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          title = COALESCE(excluded.title, authorized_chats.title),
          approved_at = excluded.approved_at;
      `,
      args: [chatId, title ?? null, now],
    });

    this.authorizedSet.add(chatId);
    this.checkedTimestamps.set(chatId, Date.now() + this.TTL_MS);
  }

  /**
   * Deauthorizes a chat from the database (used for testing).
   */
  async deauthorizeChat(chatId: number): Promise<void> {
    await this.client.execute({
      sql: `DELETE FROM authorized_chats WHERE chat_id = ?;`,
      args: [chatId],
    });

    this.authorizedSet.delete(chatId);
    this.checkedTimestamps.delete(chatId);
  }

  /**
   * Clears the in-memory cache (used for testing cache misses/reloads).
   */
  clearCache(): void {
    this.authorizedSet.clear();
    this.checkedTimestamps.clear();
  }
}

export const sanctuaryRepository = new SanctuaryRepository();
