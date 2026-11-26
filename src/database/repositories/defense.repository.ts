import { getDatabaseClient } from "../client";

export interface CorruptionRecord {
  id: number;
  chat_id: number;
  user_id: number;
  issued_by: number;
  reason: string | null;
  created_at: string;
}

export type WhisperResponseType = "TEXT" | "STICKER" | "ANIMATION" | "PHOTO";

export interface GroupWhisper {
  chat_id: number;
  trigger_word: string;
  response_type: WhisperResponseType;
  text_content: string | null;
  file_id: string | null;
  created_by: number;
  created_at: string;
}

export type WarnPunishment = "SILENCE" | "EXILE" | "BANISH";

export interface WardConfig {
  warn_limit: number;
  warn_punishment: WarnPunishment;
  ward_enabled: number;
  ward_whitelist: string[];
}

const DEFAULT_WHITELIST = ["t.me", "telegram.org"];
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class DefenseRepository {
  private client = getDatabaseClient();
  private whispersCache = new Map<number, { data: Map<string, GroupWhisper>; expiresAt: number }>();
  private wardConfigCache = new Map<number, { data: WardConfig; expiresAt: number }>();

  // =========================================================================
  // 1. Corruption (Warn) System
  // =========================================================================

  async addCorruption(
    chatId: number,
    userId: number,
    issuedBy: number,
    reason: string
  ): Promise<number> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO member_corruptions (chat_id, user_id, issued_by, reason, created_at)
        VALUES (?, ?, ?, ?, ?);
      `,
      args: [chatId, userId, issuedBy, reason, now],
    });

    const countRes = await this.client.execute({
      sql: `SELECT COUNT(*) as total FROM member_corruptions WHERE chat_id = ? AND user_id = ?;`,
      args: [chatId, userId],
    });

    return Number(countRes.rows[0]?.total || 1);
  }

  async removeLatestCorruption(chatId: number, userId: number): Promise<number> {
    await this.client.execute({
      sql: `
        DELETE FROM member_corruptions
        WHERE id = (
          SELECT id FROM member_corruptions
          WHERE chat_id = ? AND user_id = ?
          ORDER BY id DESC
          LIMIT 1
        );
      `,
      args: [chatId, userId],
    });

    const countRes = await this.client.execute({
      sql: `SELECT COUNT(*) as total FROM member_corruptions WHERE chat_id = ? AND user_id = ?;`,
      args: [chatId, userId],
    });

    return Number(countRes.rows[0]?.total || 0);
  }

  async clearCorruptions(chatId: number, userId: number): Promise<void> {
    await this.client.execute({
      sql: `DELETE FROM member_corruptions WHERE chat_id = ? AND user_id = ?;`,
      args: [chatId, userId],
    });
  }

  async getCorruptions(chatId: number, userId: number): Promise<CorruptionRecord[]> {
    const res = await this.client.execute({
      sql: `
        SELECT * FROM member_corruptions
        WHERE chat_id = ? AND user_id = ?
        ORDER BY id ASC;
      `,
      args: [chatId, userId],
    });

    return res.rows as unknown as CorruptionRecord[];
  }

  // =========================================================================
  // 2. Grey Fog Whispers (Keyword & Sticker Filters)
  // =========================================================================

  async setWhisper(
    chatId: number,
    triggerWord: string,
    responseType: WhisperResponseType,
    textContent: string | null,
    fileId: string | null,
    createdBy: number
  ): Promise<void> {
    const cleanTrigger = triggerWord.trim().toLowerCase();
    const now = new Date().toISOString();

    await this.client.execute({
      sql: `
        INSERT INTO group_whispers (chat_id, trigger_word, response_type, text_content, file_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(chat_id, trigger_word) DO UPDATE SET
          response_type = excluded.response_type,
          text_content = excluded.text_content,
          file_id = excluded.file_id,
          created_by = excluded.created_by,
          created_at = excluded.created_at;
      `,
      args: [chatId, cleanTrigger, responseType, textContent, fileId, createdBy, now],
    });

    this.whispersCache.delete(chatId);
  }

  async removeWhisper(chatId: number, triggerWord: string): Promise<boolean> {
    const cleanTrigger = triggerWord.trim().toLowerCase();
    const res = await this.client.execute({
      sql: `DELETE FROM group_whispers WHERE chat_id = ? AND trigger_word = ?;`,
      args: [chatId, cleanTrigger],
    });

    this.whispersCache.delete(chatId);
    return (res.rowsAffected ?? 0) > 0;
  }

  async getChatWhispers(chatId: number): Promise<Map<string, GroupWhisper>> {
    const cached = this.whispersCache.get(chatId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const res = await this.client.execute({
      sql: `SELECT * FROM group_whispers WHERE chat_id = ? ORDER BY trigger_word ASC;`,
      args: [chatId],
    });

    const map = new Map<string, GroupWhisper>();
    for (const row of res.rows as unknown as GroupWhisper[]) {
      map.set(row.trigger_word.toLowerCase(), row);
    }

    this.whispersCache.set(chatId, {
      data: map,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return map;
  }

  // =========================================================================
  // 3. Spiritual Ward (Anti-Link & Corruption Threshold Config)
  // =========================================================================

  private parseWhitelist(raw?: string | null): string[] {
    if (!raw || raw.trim().length === 0) return [...DEFAULT_WHITELIST];
    return raw
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0);
  }

  async getWardConfig(chatId: number): Promise<WardConfig> {
    const cached = this.wardConfigCache.get(chatId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const res = await this.client.execute({
      sql: `
        SELECT warn_limit, warn_punishment, ward_enabled, ward_whitelist
        FROM group_settings
        WHERE chat_id = ?
        LIMIT 1;
      `,
      args: [chatId],
    });

    let configData: WardConfig = {
      warn_limit: 3,
      warn_punishment: "SILENCE",
      ward_enabled: 0,
      ward_whitelist: [...DEFAULT_WHITELIST],
    };

    if (res.rows.length > 0) {
      const row = res.rows[0];
      const punishmentRaw = String(row.warn_punishment || "SILENCE").toUpperCase();
      const punishment: WarnPunishment =
        punishmentRaw === "EXILE" || punishmentRaw === "BANISH" ? punishmentRaw : "SILENCE";

      configData = {
        warn_limit: Number(row.warn_limit ?? 3) || 3,
        warn_punishment: punishment,
        ward_enabled: Number(row.ward_enabled ?? 0),
        ward_whitelist: this.parseWhitelist(row.ward_whitelist as string | null),
      };
    }

    this.wardConfigCache.set(chatId, {
      data: configData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return configData;
  }

  async setWardEnabled(chatId: number, enabled: boolean): Promise<void> {
    const val = enabled ? 1 : 0;
    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, ward_enabled)
        VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          ward_enabled = excluded.ward_enabled;
      `,
      args: [chatId, val],
    });

    this.wardConfigCache.delete(chatId);
  }

  async addWardDomain(chatId: number, domain: string): Promise<string[]> {
    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];

    if (!cleanDomain) {
      const current = await this.getWardConfig(chatId);
      return current.ward_whitelist;
    }

    const current = await this.getWardConfig(chatId);
    const updatedSet = new Set(current.ward_whitelist);
    updatedSet.add(cleanDomain);
    const updatedList = Array.from(updatedSet);
    const joined = updatedList.join(",");

    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, ward_whitelist)
        VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          ward_whitelist = excluded.ward_whitelist;
      `,
      args: [chatId, joined],
    });

    this.wardConfigCache.delete(chatId);
    return updatedList;
  }

  clearCache(chatId?: number): void {
    if (chatId !== undefined) {
      this.whispersCache.delete(chatId);
      this.wardConfigCache.delete(chatId);
    } else {
      this.whispersCache.clear();
      this.wardConfigCache.clear();
    }
  }
}

export const defenseRepository = new DefenseRepository();
