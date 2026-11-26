import { InlineKeyboard } from "grammy";
import { MyContext } from "../../middlewares/context";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function corruptCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, rawReason } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username to inflict a mark of corruption. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const reason = rawReason.trim() || "Spiritual transgression against the Tarot Club";

  const currentTargetRole = await resolveUserRole(ctx, target.userId);
  const botInfo = ctx.me;
  const check = canActOnTarget(ctx.memberRole, currentTargetRole, from.id, target.userId, botInfo.id);

  if (!check.allowed) {
    await ctx.reply(check.reason || "𓆩 The hierarchy of the council forbids this act. 𓆪", {
      parse_mode: "HTML",
    });
    return;
  }

  // Record corruption mark
  const count = await defenseRepository.addCorruption(chat.id, target.userId, from.id, reason);
  const wardConfig = await defenseRepository.getWardConfig(chat.id);
  const warnLimit = wardConfig.warn_limit;

  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "CORRUPT",
    reason: `[${count}/${warnLimit}] ${reason}`,
  });

  // Check Loss of Control threshold
  if (count >= warnLimit) {
    const punishment = wardConfig.warn_punishment;
    let punishmentOutcome = "";
    let punishmentError: string | null = null;

    try {
      if (punishment === "BANISH") {
        await ctx.banChatMember(target.userId);
        punishmentOutcome = "Permanently banished from the sanctuary";
      } else if (punishment === "EXILE") {
        await ctx.banChatMember(target.userId);
        await ctx.unbanChatMember(target.userId);
        punishmentOutcome = "Exiled beyond the borders of the Grey Fog";
      } else {
        // Default: SILENCE for 24 hours
        const untilDate = Math.floor(Date.now() / 1000) + 86400;
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
          { until_date: untilDate }
        );
        punishmentOutcome = "Silenced for 24 hours to stabilize their spirit body";
      }
    } catch (err: any) {
      punishmentError = err?.description || err?.message || "Missing administrator privileges";
      punishmentOutcome = `Punishment (${punishment}) could not be enforced in Telegram (${punishmentError})`;
    }

    // Reset corruption marks after Loss of Control
    await defenseRepository.clearCorruptions(chat.id, target.userId);

    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      target_id: target.userId,
      action: "LOSS_OF_CONTROL",
      reason: `Reached [${count}/${warnLimit}] marks -> ${punishment}`,
    });

    const locResponse = [
      formatHeader("Loss of Control Above the Grey Fog"),
      `☠️ ${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has succumbed to madness at <b>[${count}/${warnLimit}]</b> corruption marks!`,
      `\n<b>Final Transgression:</b> ${escapeHtml(reason)}`,
      `<b>Divine Sentence:</b> ${escapeHtml(punishmentOutcome)}`,
      `<b>Executor:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
      formatDivider(),
      `<i>Their corruption slate has been reset following judgment.</i>`,
    ].join("\n");

    await ctx.reply(locResponse, { parse_mode: "HTML" });
    return;
  }

  // Standard corruption mark (< warnLimit)
  const keyboard = new InlineKeyboard().text(
    "✨ Purify Mark",
    `corrupt:purify:${target.userId}`
  );

  const response = [
    formatHeader("Mark of Spiritual Corruption"),
    `${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has been afflicted with a mark of corruption.`,
    `\n<b>Corruption Level:</b> <code>[${count}/${warnLimit}]</code>`,
    `<b>Reason:</b> ${escapeHtml(reason)}`,
    `<b>Inscribed by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>"Beware the whispers of the cosmos, lest you lose control at [${warnLimit}/${warnLimit}]."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML", reply_markup: keyboard });
}
