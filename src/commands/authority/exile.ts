import { MyContext } from "../../middlewares/context";
import { auditRepository } from "../../database/repositories/audit.repository";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function exileCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, rawReason } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username to enact divine exile. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const reason = rawReason.trim() || "Expelled beyond the boundaries of the sanctuary";

  const currentTargetRole = await resolveUserRole(ctx, target.userId);
  const botInfo = ctx.me;
  const check = canActOnTarget(ctx.memberRole, currentTargetRole, from.id, target.userId, botInfo.id);

  if (!check.allowed) {
    await ctx.reply(check.reason || "𓆩 The hierarchy of the council forbids this act. 𓆪", {
      parse_mode: "HTML",
    });
    return;
  }

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
    `${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has been cast beyond the perimeter of the Grey Fog.`,
    `\n<b>Reason:</b> ${escapeHtml(reason)}`,
    `<b>Decree by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>They may return only should an invitation be extended once more.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
