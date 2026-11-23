import { MyContext } from "../../middlewares/context";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, escapeHtml } from "../../utils/formatters";

export async function eraseCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  const message = ctx.message;
  if (!from || !chat || !message) return;

  const replyTo = message.reply_to_message;
  if (!replyTo) {
    await ctx.reply(
      "𓆩 Reply to a message to begin the ritual of erasure. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const parts = message.text?.trim().split(/\s+/) || [];
  let count = 1;

  if (parts.length > 1) {
    const parsed = parseInt(parts[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      count = Math.min(20, Math.max(1, parsed));
    }
  }

  let deletedCount = 0;
  const startMsgId = replyTo.message_id;

  // 1. Delete replied-to message and sequential messages if count > 1
  for (let i = 0; i < count; i++) {
    const targetId = startMsgId + i;
    try {
      await ctx.api.deleteMessage(chat.id, targetId);
      deletedCount++;
    } catch {
      // Message might already be deleted or not found; proceed
    }
  }

  // 2. Delete the /erase command message itself
  try {
    await ctx.api.deleteMessage(chat.id, message.message_id);
  } catch {
    // Ignore deletion error for command message
  }

  // 3. Log audit
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: replyTo.from?.id,
    action: "ERASE",
    reason: `Purged ${deletedCount} messages`,
  });

  // 4. Send brief confirmation that auto-deletes after 4 seconds
  try {
    const confirm = await ctx.reply(
      `${formatHeader("Divine Erasure")}\n<i>${deletedCount} heretical whisper(s) dissolved into the Grey Fog.</i>`,
      { parse_mode: "HTML" }
    );

    setTimeout(() => {
      ctx.api.deleteMessage(chat.id, confirm.message_id).catch(() => {});
    }, 4000);
  } catch (err: any) {
    console.error("[erase] Confirmation message failed:", err?.message);
  }
}
