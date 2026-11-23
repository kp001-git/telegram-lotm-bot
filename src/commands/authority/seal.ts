import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function sealCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const reason = parts.slice(1).join(" ").trim() || "Sacred council deliberations";

  // Lock group permissions for regular members
  try {
    await ctx.setChatPermissions({
      can_send_messages: false,
      can_send_audios: false,
      can_send_documents: false,
      can_send_photos: false,
      can_send_videos: false,
      can_send_video_notes: false,
      can_send_voice_notes: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
      can_invite_users: false,
    });
  } catch (err: any) {
    await ctx.reply(
      `𓆩 The ritual lacks divine anchor. The bot requires administrator privileges to seal the sanctuary (${escapeHtml(
        err.description || err.message
      )}). 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // Persist sealed status in Turso
  await groupRepository.upsertSettings(chat.id, { is_sealed: 1 });

  // Audit log
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    action: "SEAL",
    reason,
  });

  const response = [
    formatHeader("The Sanctuary is Sealed"),
    `The ancient Grey Fog descends and envelops the hall. Only high-sequence members of the Tarot Club Council may speak.`,
    `\n<b>Decree:</b> ${escapeHtml(reason)}`,
    `<b>Sealed by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>"Maintain reverence in the presence of the deities."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
