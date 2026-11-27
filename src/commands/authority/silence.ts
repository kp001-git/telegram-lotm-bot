import { MyContext } from "../../middlewares/context";
import { auditRepository } from "../../database/repositories/audit.repository";
import { groupRepository } from "../../database/repositories/group.repository";
import { renderModTemplate } from "./decree";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole, parseDuration } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function silenceCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, remainingArgs } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Reply to a loudmouth, pass their User ID, or type @username. Mind-reading isn't part of my job description. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  // Parse duration & reason
  let duration = parseDuration(remainingArgs[0]);
  let reason = "";

  if (duration.isValid) {
    reason = remainingArgs.slice(1).join(" ").trim();
  } else {
    duration = parseDuration(undefined); // permanent/indefinite
    reason = remainingArgs.join(" ").trim();
  }

  if (!reason) {
    reason = "Running their mouth without a single coherent thought";
  }

  const currentTargetRole = await resolveUserRole(ctx, target.userId);
  const botInfo = ctx.me;
  const check = canActOnTarget(ctx.memberRole, currentTargetRole, from.id, target.userId, botInfo.id);

  if (!check.allowed) {
    await ctx.reply(check.reason || "𓆩 The hierarchy of the council forbids this act. 𓆪", {
      parse_mode: "HTML",
    });
    return;
  }

  // Restrict member in Telegram
  try {
    await ctx.restrictChatMember(
      target.userId,
      {
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
      },
      { until_date: duration.untilDate }
    );
  } catch (err: any) {
    await ctx.reply(
      `𓆩 The ritual lacks divine anchor. The bot requires administrator privileges to restrict members (${escapeHtml(
        err.description || err.message
      )}). 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // Audit log
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "SILENCE",
    reason: `${duration.label} | ${reason}`,
  });

  const { mute_template } = await groupRepository.getModTemplates(chat.id);
  const response = mute_template
    ? renderModTemplate(mute_template, {
        userId: target.userId,
        firstName: target.firstName || "Beyonder",
        username: target.username,
        reason,
        duration: duration.label,
      })
    : [
        formatHeader("Domain of Silence"),
        `${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)}'s voice has been muffled in the Grey Fog.`,
        `\n<b>Duration:</b> ${escapeHtml(duration.label)}`,
        `<b>Reason:</b> ${escapeHtml(reason)}`,
        `<b>Decree by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
        formatDivider(),
        `<i>The power of speech remains inaccessible until the fog recedes.</i>`,
      ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
