import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { cooldownManager } from "../../utils/cooldown";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function prayerCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  // 30-second cooldown
  const cd = cooldownManager.checkCooldown(`prayer:${from.id}`, 30, ctx.memberRole);
  if (!cd.allowed) {
    await ctx.reply(
      `𓆩 The spirit world whispers in silence. Wait <b>${cd.remainingSeconds}s</b> before sending another prayer above the Grey Fog. 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const petition = parts.slice(1).join(" ").trim();

  // Increment prayers count and award +25 Spirituality XP in Turso
  const totalPrayers = await userRepository.incrementPrayers(from.id, ctx.chat?.id, 25);

  const petitionBlock = petition
    ? `\n<b>Petitioner's Whisper:</b>\n<i>"${escapeHtml(petition)}"</i>\n`
    : "";

  const response = [
    formatHeader("Supplication to The Fool"),
    `<b>Petitioner:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>"The Fool that doesn't belong to this era;</i>`,
    `<i>The Mysterious Ruler above the Gray Fog;</i>`,
    `<i>The King of Yellow and Black who wields good luck."</i>`,
    petitionBlock,
    formatDivider(),
    `🕯 <b>Spiritual Devotion Count:</b> <code>${totalPrayers}</code> prayers inscribed`,
    `<i>"Your whispers echo across the spirit world, enveloped in the protective fog."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
