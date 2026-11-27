import { Bot } from "grammy";
import { MyContext } from "../../middlewares/context";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { isShadowSovereign } from "../../config";
import { formatHeader, formatDivider, formatUserMention } from "../../utils/formatters";

export async function purifyCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username to purify 1 mark of corruption. 𓆪",
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

  const existing = await defenseRepository.getCorruptions(chat.id, target.userId);
  if (existing.length === 0) {
    await ctx.reply(
      `𓆩 ${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)}'s spirit body is already free of corruption marks. 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const remaining = await defenseRepository.removeLatestCorruption(chat.id, target.userId);
  const wardConfig = await defenseRepository.getWardConfig(chat.id);

  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "PURIFY",
    reason: `Purified 1 corruption mark (remaining: [${remaining}/${wardConfig.warn_limit}])`,
  });

  const response = [
    formatHeader("Spiritual Purification"),
    `✨ One mark of corruption has been cleansed from ${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)}.`,
    `\n<b>Remaining Corruption:</b> <code>[${remaining}/${wardConfig.warn_limit}]</code>`,
    `<b>Purified by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>"The Crimson Moon recedes; clarity returns to the spirit body."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}

export function registerCorruptionCallbacks(bot: Bot<MyContext>): void {
  bot.callbackQuery(/^corrupt:purify:(\d+)$/, async (ctx) => {
    const from = ctx.from;
    const chat = ctx.chat;
    if (!from || !chat) {
      await ctx.answerCallbackQuery();
      return;
    }

    const role = await resolveUserRole(ctx, from.id);
    if (
      !isShadowSovereign(from.id) &&
      role !== "CELESTIAL_WORTHY" &&
      role !== "THE_FOOL" &&
      role !== "THE_WORLD" &&
      role !== "THE_STAR"
    ) {
      await ctx.answerCallbackQuery({
        text: "𓆩 Nice try, Sequence 9. Only the Council touches this seal. 𓆪",
        show_alert: true,
      });
      return;
    }

    const targetId = parseInt(ctx.match[1], 10);
    const existing = await defenseRepository.getCorruptions(chat.id, targetId);

    if (existing.length === 0) {
      await ctx.answerCallbackQuery({
        text: "𓆩 No active corruption marks remain on this Beyonder. 𓆪",
        show_alert: true,
      });
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } catch {
        // Ignore if already removed
      }
      return;
    }

    const remaining = await defenseRepository.removeLatestCorruption(chat.id, targetId);
    const wardConfig = await defenseRepository.getWardConfig(chat.id);

    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      target_id: targetId,
      action: "PURIFY",
      reason: `Purified 1 corruption mark via inline seal (remaining: [${remaining}/${wardConfig.warn_limit}])`,
    });

    const updatedText = [
      formatHeader("Corruption Mark Purified"),
      `✨ A mark of corruption on Beyonder <code>${targetId}</code> was purified by ${formatUserMention(from.id, from.first_name, from.username)}.`,
      `\n<b>Remaining Corruption:</b> <code>[${remaining}/${wardConfig.warn_limit}]</code>`,
      formatDivider(),
      `<i>"Mercy granted from above the Grey Fog."</i>`,
    ].join("\n");

    try {
      await ctx.editMessageText(updatedText, { parse_mode: "HTML" });
    } catch {
      // Ignore edit error
    }

    await ctx.answerCallbackQuery({ text: "𓆩 1 Corruption mark purified. 𓆪" });
  });
}
