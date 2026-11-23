import { InlineKeyboard } from "grammy";
import { MyContext } from "../../middlewares/context";
import { cooldownManager } from "../../utils/cooldown";
import { userRepository } from "../../database/repositories/user.repository";
import mysticalEvents from "../../data/mystical_events.json";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export interface RitualEvent {
  id: string;
  title: string;
  description: string;
  aura: string;
}

interface ActiveRitualSession {
  event: RitualEvent;
  chatId: number;
  initiatorId: number;
  participants: Map<number, string>; // userId -> firstName
  maxParticipants: number;
}

export const activeRituals = new Map<string, ActiveRitualSession>();

export async function ritualCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;

  // 5-minute cooldown (300 seconds) per chat
  const cd = cooldownManager.checkCooldown(`ritual:${chat.id}`, 300, ctx.memberRole);
  if (!cd.allowed) {
    const minutes = Math.floor(cd.remainingSeconds / 60);
    const seconds = cd.remainingSeconds % 60;
    await ctx.reply(
      `𓆩 The ambient spirituality is recovering from the prior rite. Wait <b>${minutes}m ${seconds}s</b> before invoking another ritual. 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const events = mysticalEvents.ritual_events as RitualEvent[];
  const event = events[Math.floor(Math.random() * events.length)];

  // Session ID
  const sessionId = `${chat.id}_${Date.now()}`;
  const participants = new Map<number, string>();
  participants.set(from.id, from.first_name);

  // Automatically record prayer/devotion for initiator
  await userRepository.incrementPrayers(from.id);

  activeRituals.set(sessionId, {
    event,
    chatId: chat.id,
    initiatorId: from.id,
    participants,
    maxParticipants: 5,
  });

  const keyboard = new InlineKeyboard().text(
    `🕯 Channel Spirituality (1/5)`,
    `ritual:channel:${sessionId}`
  );

  const response = [
    formatHeader(`Mystical Ritual: ${event.title}`),
    `<b>Sanctuary:</b> ${escapeHtml(chat.title || "The Divine Hall")}`,
    `<b>Convoked by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    `<b>Spiritual Aura:</b> <i>${escapeHtml(event.aura)}</i>`,
    formatDivider(),
    `🔮 <b>Cosmic Phenomenon:</b>\n<i>${escapeHtml(event.description)}</i>`,
    formatDivider(),
    `👥 <b>Channeling Seekers (1/5):</b>\n • ${escapeHtml(from.first_name)}`,
    formatDivider(),
    `<i>Touch the seal below to channel your spirituality into the divine circle (+1 Devotion).</i>`,
  ].join("\n");

  await ctx.reply(response, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}
