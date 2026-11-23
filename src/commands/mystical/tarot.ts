import { MyContext } from "../../middlewares/context";
import tarotData from "../../data/tarot_cards.json";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export interface TarotCard {
  card: string;
  arcana_number: number;
  lotm_association: string;
  upright: string;
  reversed: string;
  guidance: string;
}

export async function tarotCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const cards = tarotData as TarotCard[];
  const card = cards[Math.floor(Math.random() * cards.length)];
  const isUpright = Math.random() >= 0.5;

  const orientationText = isUpright ? "Upright ⟰" : "Reversed ⟱";
  const interpretation = isUpright ? card.upright : card.reversed;

  const response = [
    formatHeader(`Tarot Divination: ${card.card}`),
    `<b>Querent:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    `<b>Orientation:</b> <b>${orientationText}</b>`,
    `<b>Tarot Club Resonance:</b> <i>${escapeHtml(card.lotm_association)}</i>`,
    formatDivider(),
    `🔮 <b>Mystical Interpretation:</b>\n<i>${escapeHtml(interpretation)}</i>`,
    formatDivider(),
    `🕯 <b>Spiritual Guidance:</b>\n${escapeHtml(card.guidance)}`,
    formatDivider(),
    `<i>"The cards do not dictate destiny; they reveal the unseen currents of the fog."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
