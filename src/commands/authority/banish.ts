import { MyContext } from "../../middlewares/context";
import { auditRepository } from "../../database/repositories/audit.repository";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function banishCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, rawReason } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username to enact eternal banishment. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const reason = rawReason.trim() || "Corruption and violation of sacred decrees";

  const currentTargetRole = await resolveUserRole(ctx, target.userId);
  const botInfo = ctx.me;
  const check = canActOnTarget(ctx.memberRole, currentTargetRole, from.id, target.userId, botInfo.id);

  if (!check.allowed) {
    await ctx.reply(check.reason || "𓆩 The hierarchy of the council forbids this act. 𓆪", {
      parse_mode: "HTML",
    });
    return;
  }

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

  const response = [
    formatHeader("Eternal Banishment"),
    `${formatUserMention(target.userId, target.firstName || "Corrupt Entity", target.username)} has been severed from the sanctuary of the Grey Fog.`,
    `\n<b>Reason:</b> ${escapeHtml(reason)}`,
    `<b>Decree by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>Their spiritual thread in this domain is severed permanently.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
