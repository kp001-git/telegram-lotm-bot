import { Bot, InlineKeyboard } from "grammy";
import { MyContext } from "../../middlewares/context";
import { groupOnlyGuard } from "../../middlewares/guard";
import { pathwayCommand } from "./pathway";
import { sequenceCommand } from "./sequence";
import { potionCommand } from "./potion";
import { tarotCommand } from "./tarot";
import { fateCommand } from "./fate";
import { prayerCommand } from "./prayer";
import { ritualCommand, activeRituals } from "./ritual";
import { userRepository } from "../../database/repositories/user.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export * from "./pathway";
export * from "./sequence";
export * from "./potion";
export * from "./tarot";
export * from "./fate";
export * from "./prayer";
export * from "./ritual";

export function registerMysticalCommands(bot: Bot<MyContext>): void {
  // Lore & Pathways
  bot.command("pathway", pathwayCommand);
  bot.command("sequence", sequenceCommand);
  bot.command("potion", potionCommand);

  // Divination & Rituals
  bot.command("tarot", tarotCommand);
  bot.command("fate", fateCommand);
  bot.command("prayer", prayerCommand);
  bot.command("ritual", groupOnlyGuard, ritualCommand);

  // Interactive Ritual Channeling Callback: ritual:channel:<sessionId>
  bot.callbackQuery(/^ritual:channel:(.+)$/, async (ctx) => {
    const sessionId = ctx.match[1];
    const from = ctx.from;
    const session = activeRituals.get(sessionId);

    if (!from || !session) {
      await ctx.answerCallbackQuery({
        text: "𓆩 This ritual circle has dispersed into the spirit world. 𓆪",
        show_alert: true,
      });
      return;
    }

    if (session.participants.has(from.id)) {
      await ctx.answerCallbackQuery({
        text: "𓆩 You have already channeled your spirituality into this ritual. 𓆪",
        show_alert: true,
      });
      return;
    }

    if (session.participants.size >= session.maxParticipants) {
      await ctx.answerCallbackQuery({
        text: "𓆩 The ritual circle has achieved maximum harmonic resonance (5/5). 𓆪",
        show_alert: true,
      });
      return;
    }

    // Add participant & increment devotion in Turso
    session.participants.set(from.id, from.first_name);
    await userRepository.incrementPrayers(from.id);

    const count = session.participants.size;
    const isCompleted = count >= session.maxParticipants;

    await ctx.answerCallbackQuery({
      text: "𓆩 Your spirituality channels into the divine circle (+1 Devotion). 𓆪",
    });

    const participantsList = Array.from(session.participants.values())
      .map((name) => ` • ${escapeHtml(name)}`)
      .join("\n");

    const statusNote = isCompleted
      ? `✨ <b>Ritual Consummated:</b> The spiritual frequency has achieved perfect harmony! All participants are blessed with clarity.`
      : `<i>Touch the seal below to channel your spirituality into the divine circle (+1 Devotion).</i>`;

    const updatedText = [
      formatHeader(`Mystical Ritual: ${session.event.title}`),
      `<b>Spiritual Aura:</b> <i>${escapeHtml(session.event.aura)}</i>`,
      formatDivider(),
      `🔮 <b>Cosmic Phenomenon:</b>\n<i>${escapeHtml(session.event.description)}</i>`,
      formatDivider(),
      `👥 <b>Channeling Seekers (${count}/${session.maxParticipants}):</b>\n${participantsList}`,
      formatDivider(),
      statusNote,
    ].join("\n");

    const keyboard = isCompleted
      ? undefined
      : new InlineKeyboard().text(
          `🕯 Channel Spirituality (${count}/${session.maxParticipants})`,
          `ritual:channel:${sessionId}`
        );

    try {
      await ctx.editMessageText(updatedText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch {
      // Ignore if identical
    }
  });
}
