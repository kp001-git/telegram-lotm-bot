import { MyContext } from "../../middlewares/context";
import { cooldownManager } from "../../utils/cooldown";
import mysticalEvents from "../../data/mystical_events.json";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function fateCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  // 30-second cooldown per user
  const cd = cooldownManager.checkCooldown(`fate:${from.id}`, 30, ctx.memberRole);
  if (!cd.allowed) {
    await ctx.reply(
      `𓆩 Stop spamming the pendulum like an anxious gambling addict. Your fragile spirit needs <b>${cd.remainingSeconds}s</b> to recover. 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const omens = mysticalEvents.fate_omens;
  const omen = omens[Math.floor(Math.random() * omens.length)];

  const ratingBadge =
    omen.rating === "Blessed by The Fool"
      ? "👑 <b>Blessed by The Fool</b>"
      : omen.rating === "Auspicious Resonance"
      ? "✨ <b>Auspicious Resonance</b>"
      : omen.rating === "Misty Uncertainty"
      ? "🌫 <b>Misty Uncertainty</b>"
      : "🩸 <b>Crimson Warning</b>";

  const response = [
    formatHeader("Spirit Pendulum Fate Divination"),
    `<b>Querent:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    `<b>Omen:</b> ${escapeHtml(omen.title)}`,
    `<b>Resonance:</b> ${ratingBadge}`,
    formatDivider(),
    `🔮 <b>Prophecy:</b>\n<i>${escapeHtml(omen.prophecy)}</i>`,
    formatDivider(),
    `<i>"Don't blame the pendulum if your luck is as tragic as your Sequence rank."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
