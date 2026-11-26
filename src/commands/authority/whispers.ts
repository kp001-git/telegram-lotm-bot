import { MyContext } from "../../middlewares/context";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function whispersCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  if (!chat) return;

  const whispersMap = await defenseRepository.getChatWhispers(chat.id);
  const whispers = Array.from(whispersMap.values());

  if (whispers.length === 0) {
    await ctx.reply(
      "𓆩 No Grey Fog whispers are currently bound in this sanctuary. Council members may bind them via <code>/whisper</code>. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const entries = whispers
    .map((w) => ` • <code>${escapeHtml(w.trigger_word)}</code> — <code>[${w.response_type}]</code>`)
    .join("\n");

  const response = [
    formatHeader("Bound Grey Fog Whispers"),
    `<i>Active automated echoes in ${escapeHtml(chat.title || "this sanctuary")} (${whispers.length}):</i>`,
    formatDivider(),
    entries,
    formatDivider(),
    `<i>Speak a trigger word to invoke its echo, or dispel via <code>/dispel &lt;trigger&gt;</code>.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
