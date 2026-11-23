import { getDatabaseClient } from "../client";

export class SystemRepository {
  private client = getDatabaseClient();

  async getMeta(key: string): Promise<string | null> {
    const result = await this.client.execute({
      sql: `SELECT value FROM system_config WHERE key = ? LIMIT 1;`,
      args: [key],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0].value as string;
  }

  async setMeta(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO system_config (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at;
      `,
      args: [key, value, now],
    });
  }
}

export const systemRepository = new SystemRepository();
