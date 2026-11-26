import { MyContext } from "../../middlewares/context";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function dispelCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const fullText = ctx.message?.text || "";
  const firstSpace = fullText.search(/\s+/);
  let trigger = firstSpace === -1 ? "" : fullText.slice(firstSpace).trim();

  if ((trigger.startsWith('"') && trigger.endsWith('"')) || (trigger.startsWith("'") && trigger.endsWith("'"))) {
    trigger = trigger.slice(1, -1).trim();
  }

  if (!trigger) {
    await ctx.reply(
      "𓆩 Specify the trigger keyword to dispel:\n<code>/dispel &lt;trigger&gt;</code> 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const removed = await defenseRepository.removeWhisper(chat.id, trigger);

  if (!removed) {
    await ctx.reply(
      `𓆩 No active Grey Fog whisper was found for trigger <code>${escapeHtml(trigger.toLowerCase())}</code>. 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    action: "WHISPER_DISPEL",
    reason: `Dispelled trigger "${trigger.toLowerCase()}"`,
  });

  const response = [
    formatHeader("Grey Fog Whisper Dispelled"),
    `💨 The echo bound to <code>${escapeHtml(trigger.toLowerCase())}</code> has dissolved into the mist.`,
    formatDivider(),
    `<i>The trigger will no longer invoke an automated response.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
