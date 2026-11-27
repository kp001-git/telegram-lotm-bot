import { MyContext } from "../../middlewares/context";
import { auditRepository } from "../../database/repositories/audit.repository";
import { groupRepository } from "../../database/repositories/group.repository";
import { markModerationRemoval } from "../board/farewell";
import { renderModTemplate } from "./decree";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function banishCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, rawReason } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Who am I supposed to vaporize, genius? Reply to a message, pass a User ID, or type @username. Basic literacy isn't optional. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const reason = rawReason.trim() || "Being an insufferable waste of spirituality";

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

  // Execute Telegram ban
  try {
    await ctx.banChatMember(target.userId);
  } catch (err: any) {
    await ctx.reply(
      `𓆩 The ritual lacks divine anchor. The bot requires administrator privileges to banish members (${escapeHtml(
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
    action: "BANISH",
    reason,
  });

  const { ban_template } = await groupRepository.getModTemplates(chat.id);
  const response = ban_template
    ? renderModTemplate(ban_template, {
        userId: target.userId,
        firstName: target.firstName || "Corrupt Entity",
        username: target.username,
        reason,
        duration: "Permanent",
      })
    : [
        formatHeader("Eternal Banishment"),
        `${formatUserMention(target.userId, target.firstName || "Corrupt Entity", target.username)} has been permanently yeeted into the abyss above the Grey Fog. Good riddance.`,
        `\n<b>Crime:</b> ${escapeHtml(reason)}`,
        `<b>Executed by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
        formatDivider(),
        `<i>Nothing of value was lost today.</i>`,
      ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
