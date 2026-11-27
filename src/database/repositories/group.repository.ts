import { Api } from "grammy";
import { getDatabaseClient } from "../client";
import { isShadowSovereign } from "../../config";
import { defenseRepository, WarnPunishment } from "./defense.repository";
import defaultLaws from "../../data/sacred_laws.json";
import defaultLore from "../../data/default_lore.json";

export interface DmSession {
  active_chat_id: number;
  pending_input: string | null;
}

const DM_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface GroupSettings {
  chat_id: number;
  sacred_laws: string | null;
  lore_text: string | null;
  welcome_template: string | null;
  welcome_enabled?: number;
  goodbye_enabled?: number;
  goodbye_template?: string | null;
  ban_template?: string | null;
  mute_template?: string | null;
  is_sealed: number;
  log_chat_id: string | null;
}

export const DEFAULT_WELCOME_TEMPLATE =
  "𓆩 A SOUL SUMMONED ABOVE THE GREY FOG 𓆪\nWelcome {mention} to {group}.\nYou have crossed the crimson threshold as Beyonder #{count}.\n\nObserve the Sacred Laws, respect the Divine Council, and protect your anchor against madness.";

export const DEFAULT_GOODBYE_TEMPLATE =
  "𓆩 {name} has stepped down from the Grey Fog and departed {group}. May the Fool watch over their journey. 𓆪";

export function getDefaultLawsText(): string {
  const laws = defaultLaws.map(
    (l) => `<b>${l.index}. ${l.title}</b>\n<i>${l.decree}</i>`
  );
  return laws.join("\n\n");
}

export function getDefaultLoreText(): string {
  return [
    `<b>𓆩 ${defaultLore.title.toUpperCase()} 𓆪</b>`,
    "",
    `<b>Domain Origins:</b>\n<i>${defaultLore.history}</i>`,
    "",
    `<b>The Sacred Purpose:</b>\n<i>${defaultLore.ethos}</i>`,
    "",
    `<b>Cosmic Warning:</b>\n<i>${defaultLore.warning}</i>`,
  ].join("\n");
}

export class GroupRepository {
  private client = getDatabaseClient();
  private dmSessionCache = new Map<number, { data: DmSession | null; expiresAt: number }>();

  async getSettings(chatId: number): Promise<GroupSettings | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM group_settings WHERE chat_id = ? LIMIT 1;`,
      args: [chatId],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as GroupSettings;
  }

  async upsertSettings(
    chatId: number,
    data: Partial<Omit<GroupSettings, "chat_id">>
  ): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, sacred_laws, lore_text, welcome_template, is_sealed, log_chat_id)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          sacred_laws = COALESCE(excluded.sacred_laws, group_settings.sacred_laws),
          lore_text = COALESCE(excluded.lore_text, group_settings.lore_text),
          welcome_template = COALESCE(excluded.welcome_template, group_settings.welcome_template),
          is_sealed = COALESCE(excluded.is_sealed, group_settings.is_sealed),
          log_chat_id = COALESCE(excluded.log_chat_id, group_settings.log_chat_id);
      `,
      args: [
        chatId,
        data.sacred_laws ?? null,
        data.lore_text ?? null,
        data.welcome_template ?? null,
        data.is_sealed ?? 0,
        data.log_chat_id ?? null,
      ],
    });
  }

  async getSacredLaws(chatId: number): Promise<string> {
    const settings = await this.getSettings(chatId);
    if (settings && settings.sacred_laws && settings.sacred_laws.trim().length > 0) {
      return settings.sacred_laws;
    }
    return getDefaultLawsText();
  }

  async setSacredLaws(chatId: number, lawsText: string): Promise<void> {
    await this.upsertSettings(chatId, { sacred_laws: lawsText });
  }

  async getLore(chatId: number): Promise<string> {
    const settings = await this.getSettings(chatId);
    if (settings && settings.lore_text && settings.lore_text.trim().length > 0) {
      return settings.lore_text;
    }
    return getDefaultLoreText();
  }

  async setLore(chatId: number, loreText: string): Promise<void> {
    await this.upsertSettings(chatId, { lore_text: loreText });
  }

  async getWelcomeTemplate(chatId: number): Promise<string> {
    const settings = await this.getSettings(chatId);
    if (settings && settings.welcome_template && settings.welcome_template.trim().length > 0) {
      return settings.welcome_template;
    }
    return DEFAULT_WELCOME_TEMPLATE;
  }

  async setWelcomeTemplate(chatId: number, template: string): Promise<void> {
    await this.upsertSettings(chatId, { welcome_template: template });
  }

  async getWelcomeConfig(chatId: number): Promise<{ enabled: boolean; template: string }> {
    const settings = await this.getSettings(chatId);
    const enabled = settings ? (settings.welcome_enabled ?? 1) === 1 : true;
    const template =
      settings && settings.welcome_template && settings.welcome_template.trim().length > 0
        ? settings.welcome_template
        : DEFAULT_WELCOME_TEMPLATE;
    return { enabled, template };
  }

  async setWelcomeEnabled(chatId: number, enabled: boolean): Promise<void> {
    const val = enabled ? 1 : 0;
    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, welcome_enabled)
        VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          welcome_enabled = excluded.welcome_enabled;
      `,
      args: [chatId, val],
    });
  }

  async getGoodbyeConfig(chatId: number): Promise<{ enabled: boolean; template: string }> {
    const settings = await this.getSettings(chatId);
    const enabled = settings ? (settings.goodbye_enabled ?? 1) === 1 : true;
    const template =
      settings && settings.goodbye_template && settings.goodbye_template.trim().length > 0
        ? settings.goodbye_template
        : DEFAULT_GOODBYE_TEMPLATE;
    return { enabled, template };
  }

  async setGoodbyeTemplate(chatId: number, template: string): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, goodbye_template)
        VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          goodbye_template = excluded.goodbye_template;
      `,
      args: [chatId, template],
    });
  }

  async setGoodbyeEnabled(chatId: number, enabled: boolean): Promise<void> {
    const val = enabled ? 1 : 0;
    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, goodbye_enabled)
        VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          goodbye_enabled = excluded.goodbye_enabled;
      `,
      args: [chatId, val],
    });
  }

  async getModTemplates(
    chatId: number
  ): Promise<{ ban_template: string | null; mute_template: string | null }> {
    const settings = await this.getSettings(chatId);
    return {
      ban_template:
        settings?.ban_template && settings.ban_template.trim().length > 0
          ? settings.ban_template
          : null,
      mute_template:
        settings?.mute_template && settings.mute_template.trim().length > 0
          ? settings.mute_template
          : null,
    };
  }

  async setModTemplate(
    chatId: number,
    type: "ban" | "mute",
    template: string | null
  ): Promise<void> {
    const column = type === "ban" ? "ban_template" : "mute_template";
    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, ${column})
        VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          ${column} = excluded.${column};
      `,
      args: [chatId, template],
    });
  }

  async isChatSealed(chatId: number): Promise<boolean> {
    const settings = await this.getSettings(chatId);
    return settings ? settings.is_sealed === 1 : false;
  }

  // =========================================================================
  // DM Group Management Sessions & Policies
  // =========================================================================

  async setDmSession(
    userId: number,
    chatId: number,
    pendingInput: string | null = null
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO dm_sessions (user_id, active_chat_id, pending_input, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          active_chat_id = excluded.active_chat_id,
          pending_input = excluded.pending_input,
          updated_at = excluded.updated_at;
      `,
      args: [userId, chatId, pendingInput, now],
    });

    this.dmSessionCache.set(userId, {
      data: { active_chat_id: chatId, pending_input: pendingInput },
      expiresAt: Date.now() + DM_SESSION_TTL_MS,
    });
  }

  async getDmSession(userId: number): Promise<DmSession | null> {
    const cached = this.dmSessionCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const res = await this.client.execute({
      sql: `SELECT active_chat_id, pending_input FROM dm_sessions WHERE user_id = ? LIMIT 1;`,
      args: [userId],
    });

    const data: DmSession | null =
      res.rows.length > 0
        ? {
            active_chat_id: Number(res.rows[0].active_chat_id),
            pending_input: (res.rows[0].pending_input as string | null) ?? null,
          }
        : null;

    this.dmSessionCache.set(userId, {
      data,
      expiresAt: Date.now() + DM_SESSION_TTL_MS,
    });

    return data;
  }

  async setDmPendingInput(userId: number, pendingInput: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `UPDATE dm_sessions SET pending_input = ?, updated_at = ? WHERE user_id = ?;`,
      args: [pendingInput, now, userId],
    });

    const existing = this.dmSessionCache.get(userId);
    if (existing && existing.data) {
      this.dmSessionCache.set(userId, {
        data: { ...existing.data, pending_input: pendingInput },
        expiresAt: Date.now() + DM_SESSION_TTL_MS,
      });
    } else {
      this.dmSessionCache.delete(userId);
    }
  }

  async disconnectDmSession(userId: number): Promise<void> {
    await this.client.execute({
      sql: `DELETE FROM dm_sessions WHERE user_id = ?;`,
      args: [userId],
    });
    this.dmSessionCache.delete(userId);
  }

  async getAuthorizedChatTitle(chatId: number): Promise<string | null> {
    const res = await this.client.execute({
      sql: `SELECT title FROM authorized_chats WHERE chat_id = ? LIMIT 1;`,
      args: [chatId],
    });
    return res.rows.length > 0 ? (res.rows[0].title as string | null) : null;
  }

  async getAdminAuthorizedGroups(
    userId: number,
    api?: Api
  ): Promise<Array<{ chat_id: number; title: string | null }>> {
    const chatsRes = await this.client.execute({
      sql: `SELECT chat_id, title FROM authorized_chats ORDER BY approved_at DESC;`,
      args: [],
    });

    const allChats = chatsRes.rows.map((r) => ({
      chat_id: Number(r.chat_id),
      title: (r.title as string | null) ?? null,
    }));

    if (isShadowSovereign(userId)) {
      return allChats;
    }

    // 1. Check DB Council memberships in a single query
    const councilRes = await this.client.execute({
      sql: `
        SELECT chat_id FROM group_members
        WHERE user_id = ? AND role IN ('CELESTIAL_WORTHY', 'THE_FOOL', 'THE_WORLD', 'THE_STAR');
      `,
      args: [userId],
    });
    const councilChatIds = new Set<number>(councilRes.rows.map((r) => Number(r.chat_id)));

    const authorizedForAdmin: Array<{ chat_id: number; title: string | null }> = [];
    for (const chat of allChats) {
      if (councilChatIds.has(chat.chat_id)) {
        authorizedForAdmin.push(chat);
        continue;
      }

      if (api) {
        try {
          const member = await api.getChatMember(chat.chat_id, userId);
          if (member.status === "administrator" || member.status === "creator") {
            authorizedForAdmin.push(chat);
          }
        } catch {
          // Ignore if bot cannot query chat member
        }
      }
    }

    return authorizedForAdmin;
  }

  async updateCorruptionPolicy(
    chatId: number,
    warnLimit: number,
    warnPunishment: WarnPunishment
  ): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO group_settings (chat_id, warn_limit, warn_punishment)
        VALUES (?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          warn_limit = excluded.warn_limit,
          warn_punishment = excluded.warn_punishment;
      `,
      args: [chatId, warnLimit, warnPunishment],
    });

    defenseRepository.clearCache(chatId);
  }
}

export const groupRepository = new GroupRepository();
