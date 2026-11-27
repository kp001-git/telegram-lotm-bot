import { Api } from "grammy";
import { getDatabaseClient } from "../client";
import { config, isShadowSovereign } from "../../config";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export interface AuditLogEntry {
  id?: number;
  chat_id: number;
  actor_id: number;
  target_id?: number | null;
  action: string;
  reason?: string | null;
  created_at?: string;
}

export class AuditRepository {
  private client = getDatabaseClient();

  async log(entry: Omit<AuditLogEntry, "id" | "created_at">): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO audit_logs (chat_id, actor_id, target_id, action, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      args: [
        entry.chat_id,
        entry.actor_id,
        entry.target_id ?? null,
        entry.action,
        entry.reason ?? null,
        now,
      ],
    });
  }

  async logAndMirror(
    api: Api,
    entry: Omit<AuditLogEntry, "id" | "created_at">,
    summaryHtml?: string
  ): Promise<void> {
    const isShadow = isShadowSovereign(entry.actor_id);
    const sanitizedEntry = isShadow ? { ...entry, actor_id: 0 } : entry;

    // 1. Write to persistent Turso audit table (masked if Shadow Sovereign)
    await this.log(sanitizedEntry);

    // 2. Mirror to ADMIN_LOG_CHAT_ID if configured
    if (config.adminLogChatId) {
      try {
        const actorLabel = isShadow
          ? "<b>The Grey Fog</b>"
          : `<code>${sanitizedEntry.actor_id}</code>`;

        const text = summaryHtml || [
          formatHeader("Sanctuary Decree Log"),
          `<b>Action:</b> <code>${escapeHtml(sanitizedEntry.action)}</code>`,
          `<b>Executor:</b> ${actorLabel}`,
          sanitizedEntry.target_id ? `<b>Target ID:</b> <code>${sanitizedEntry.target_id}</code>` : null,
          `<b>Sanctuary Chat:</b> <code>${sanitizedEntry.chat_id}</code>`,
          sanitizedEntry.reason ? `<b>Decree Reason:</b> ${escapeHtml(sanitizedEntry.reason)}` : null,
          formatDivider(),
          `<i>Recorded above the Grey Fog</i>`,
        ].filter(Boolean).join("\n");

        await api.sendMessage(config.adminLogChatId, text, { parse_mode: "HTML" });
      } catch (err) {
        console.error(`[auditLog] Failed to mirror log to ${config.adminLogChatId}:`, err);
      }
    }
  }
}

export const auditRepository = new AuditRepository();
