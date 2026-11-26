import { MyContext } from "../../middlewares/context";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention } from "../../utils/formatters";

export async function cleanseCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username to cleanse all corruption marks. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
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

  await defenseRepository.clearCorruptions(chat.id, target.userId);
  const wardConfig = await defenseRepository.getWardConfig(chat.id);

  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "CLEANSE",
    reason: `All corruption marks wiped clean [0/${wardConfig.warn_limit}]`,
  });

  const response = [
    formatHeader("Grand Spiritual Cleansing"),
    `🕊 All marks of corruption have been completely wiped from ${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)}.`,
    `\n<b>Current Corruption:</b> <code>[0/${wardConfig.warn_limit}]</code>`,
    `<b>Cleansed by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>"May the Gray Fog shield your spirit body from future whispers."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
