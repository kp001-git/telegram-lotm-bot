import { MyContext } from "../../middlewares/context";
import { defenseRepository, WhisperResponseType } from "../../database/repositories/defense.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export function parseTriggerAndRest(rawArgs: string): { trigger: string; rest: string } | null {
  const trimmed = rawArgs.trim();
  if (!trimmed) return null;

  const firstChar = trimmed[0];
  if (firstChar === '"' || firstChar === "'") {
    const closeIdx = trimmed.indexOf(firstChar, 1);
    if (closeIdx > 1) {
      const trigger = trimmed.slice(1, closeIdx).trim().toLowerCase();
      const rest = trimmed.slice(closeIdx + 1).trim();
      if (!trigger) return null;
      return { trigger, rest };
    }
  }

  const spaceIdx = trimmed.search(/\s+/);
  if (spaceIdx === -1) {
    return { trigger: trimmed.toLowerCase(), rest: "" };
  }

  const trigger = trimmed.slice(0, spaceIdx).trim().toLowerCase();
  const rest = trimmed.slice(spaceIdx).trim();
  if (!trigger) return null;
  return { trigger, rest };
}

export async function whisperCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const fullText = ctx.message?.text || "";
  const firstSpace = fullText.search(/\s+/);
  const rawArgs = firstSpace === -1 ? "" : fullText.slice(firstSpace).trim();

  const parsed = parseTriggerAndRest(rawArgs);
  if (!parsed) {
    await ctx.reply(
      [
        "𓆩 Usage:",
        "• <code>/whisper &lt;trigger&gt; &lt;reply text&gt;</code>",
        '• <code>/whisper "multi word" &lt;reply text&gt;</code>',
        "• Reply to a Sticker, GIF, or Photo with <code>/whisper &lt;trigger&gt;</code>",
        "Placeholders: <code>{name}</code>, <code>{mention}</code> 𓆪",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  const { trigger, rest } = parsed;
  const reply = ctx.message?.reply_to_message;

  let responseType: WhisperResponseType = "TEXT";
  let fileId: string | null = null;
  let textContent: string | null = rest || null;

  if (reply?.sticker) {
    responseType = "STICKER";
    fileId = reply.sticker.file_id;
  } else if (reply?.animation) {
    responseType = "ANIMATION";
    fileId = reply.animation.file_id;
    textContent = rest || reply.caption || null;
  } else if (reply?.photo && reply.photo.length > 0) {
    responseType = "PHOTO";
    fileId = reply.photo[reply.photo.length - 1].file_id;
    textContent = rest || reply.caption || null;
  } else {
    if (!textContent && reply?.text) {
      textContent = reply.text;
    }
    if (!textContent) {
      await ctx.reply(
        `𓆩 Provide reply text or reply to a Sticker/GIF/Photo to bind trigger <code>${escapeHtml(trigger)}</code>. 𓆪`,
        { parse_mode: "HTML" }
      );
      return;
    }
  }

  await defenseRepository.setWhisper(chat.id, trigger, responseType, textContent, fileId, from.id);

  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    action: "WHISPER_SET",
    reason: `Bound trigger "${trigger}" [${responseType}]`,
  });

  const response = [
    formatHeader("Grey Fog Whisper Bound"),
    `🌫 Trigger <code>${escapeHtml(trigger)}</code> has been woven into the Grey Fog.`,
    `<b>Echo Type:</b> <code>[${responseType}]</code>`,
    textContent ? `<b>Echo Content:</b> <i>${escapeHtml(textContent.slice(0, 120))}</i>` : "",
    formatDivider(),
    `<i>Whenever this word is spoken, the fog shall answer.</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
