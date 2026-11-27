import { MyContext } from "../../middlewares/context";
import { auditRepository } from "../../database/repositories/audit.repository";
import { markModerationRemoval } from "../board/farewell";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function exileCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, rawReason } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Tag someone, reply to their trash, or give me a User ID. I can't exile thin air. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const reason = rawReason.trim() || "Stinking up the sanctuary with terminal mediocrity";

  const currentTargetRole = await resolveUserRole(ctx, target.userId);
  const botInfo = ctx.me;
  const check = canActOnTarget(ctx.memberRole, currentTargetRole, from.id, target.userId, botInfo.id);

  if (!check.allowed) {
    await ctx.reply(check.reason || "𓆩 The hierarchy of the council forbids this act. 𓆪", {
      parse_mode: "HTML",
    });
    return;
  }

  // Mark removal so left_chat_member listener does not send duplicate /farewell
  markModerationRemoval(chat.id, target.userId);

  // Execute kick: ban followed immediately by unban
  try {
    await ctx.banChatMember(target.userId);
    await ctx.unbanChatMember(target.userId);
  } catch (err: any) {
    await ctx.reply(
      `𓆩 The ritual lacks divine anchor. The bot requires administrator privileges to exile members (${escapeHtml(
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
    action: "EXILE",
    reason,
  });

  const response = [
    formatHeader("Divine Exile"),
    `${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has been kicked straight out the front door of the Grey Fog.`,
    `\n<b>Crime:</b> ${escapeHtml(reason)}`,
    `<b>Executed by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>Feel free to stay out. Nobody here was asking for your encore.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
