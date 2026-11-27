import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export function renderModTemplate(
  template: string,
  data: {
    userId: number;
    firstName: string;
    username?: string | null;
    reason: string;
    duration?: string;
  }
): string {
  const mention = formatUserMention(data.userId, data.firstName, data.username);
  return template
    .replace(/\{mention\}/gi, mention)
    .replace(/\{name\}/gi, escapeHtml(data.firstName))
    .replace(/\{reason\}/gi, escapeHtml(data.reason))
    .replace(/\{duration\}/gi, escapeHtml(data.duration || "Permanent"));
}

export async function decreeCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const fullText = ctx.message?.text || "";
  const firstSpace = fullText.search(/\s+/);
  const rawArgs = firstSpace === -1 ? "" : fullText.slice(firstSpace).trim();

  if (!rawArgs) {
    await ctx.reply(
      [
        "𓆩 Learn the syntax before wasting my time:",
        "<code>/decree &lt;ban | mute&gt; &lt;template | reset&gt;</code>",
        "",
        "<b>Placeholders:</b>",
        " • <code>{mention}</code> — Target mention",
        " • <code>{name}</code> — Target name",
        " • <code>{reason}</code> — Punishment reason",
        " • <code>{duration}</code> — Mute duration 𓆪",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  const subSpace = rawArgs.search(/\s+/);
  const targetType = (subSpace === -1 ? rawArgs : rawArgs.slice(0, subSpace)).toLowerCase();
  const payload = subSpace === -1 ? "" : rawArgs.slice(subSpace).trim();

  if (targetType !== "ban" && targetType !== "mute") {
    await ctx.reply(
      "𓆩 Choose <code>ban</code> or <code>mute</code>. It's literally a 3-letter or 4-letter word, not rocket science. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  if (!payload) {
    await ctx.reply(
      `𓆩 Provide a custom template or <code>reset</code> for <code>/decree ${targetType}</code>. Empty air doesn't write itself. 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (payload.toLowerCase() === "reset") {
    await groupRepository.setModTemplate(chat.id, targetType, null);
    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      action: "DECREE_RESET",
      reason: `Reset custom ${targetType} announcement template to default`,
    });

    await ctx.reply(
      [
        formatHeader("Moderation Decree Reset"),
        `🔄 Custom <b>${targetType.toUpperCase()}</b> template cleared. Reverted back to the default Grey Fog roast.`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  await groupRepository.setModTemplate(chat.id, targetType, payload);
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    action: "DECREE_SET",
    reason: `Set custom ${targetType} announcement template`,
  });

  await ctx.reply(
    [
      formatHeader("Moderation Decree Inscribed"),
      `📜 Custom <b>${targetType.toUpperCase()}</b> announcement template saved by ${formatUserMention(
        from.id,
        from.first_name,
        from.username
      )}.`,
      formatDivider(),
      `<b>Preview:</b>\n<i>${escapeHtml(payload)}</i>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}
