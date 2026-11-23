import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function unsealCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  // Restore group permissions
  try {
    await ctx.setChatPermissions({
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_invite_users: true,
    });
  } catch (err: any) {
    await ctx.reply(
      `𓆩 The ritual lacks divine anchor. The bot requires administrator privileges to unseal the sanctuary (${escapeHtml(
        err.description || err.message
      )}). 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // Persist unsealed status in Turso
  await groupRepository.upsertSettings(chat.id, { is_sealed: 0 });

  // Audit log
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    action: "UNSEAL",
    reason: "Sanctuary seal lifted",
  });

  const response = [
    formatHeader("The Sanctuary is Unsealed"),
    `The thick fog recedes to the periphery. The sanctuary whispers are restored to all Beyonders.`,
    `\n<b>Decree by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>The gathering may proceed in accordance with the Sacred Laws.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
