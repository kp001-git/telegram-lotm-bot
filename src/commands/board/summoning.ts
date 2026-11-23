import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

/**
 * Replaces placeholders {mention}, {name}, {group}, {count} in the welcome template.
 */
export function renderWelcomeTemplate(
  template: string,
  user: { id: number; firstName: string; username?: string | null },
  groupTitle: string,
  memberCount: number,
  isSealed: boolean
): string {
  const mention = formatUserMention(user.id, user.firstName, user.username);
  let rendered = template
    .replace(/\{mention\}/g, mention)
    .replace(/\{name\}/g, escapeHtml(user.firstName))
    .replace(/\{group\}/g, escapeHtml(groupTitle))
    .replace(/\{count\}/g, memberCount.toString());

  if (isSealed) {
    rendered +=
      "\n\n⚠️ <i>The sanctuary is currently sealed under the Grey Fog. Only Council members may speak until unsealed.</i>";
  }

  return rendered;
}

export async function summoningCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const action = parts[1]?.toLowerCase();

  // 1. Admin Override: /summoning set <template>
  if (action === "set") {
    const role = ctx.memberRole || "BEYONDER";
    if (role !== "CELESTIAL_WORTHY" && role !== "THE_FOOL") {
      await ctx.reply(
        "𓆩 Only High-Sequence Beyonders of the Council may formulate summoning incantations. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const newTemplate = parts.slice(2).join(" ").trim();
    if (!newTemplate) {
      await ctx.reply(
        "𓆩 Specify the summoning template:\n<code>/summoning set &lt;template&gt;</code>\n\n<b>Placeholders:</b>\n • <code>{mention}</code> — User tag\n • <code>{name}</code> — First name\n • <code>{group}</code> — Sanctuary name\n • <code>{count}</code> — Total member count 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    await groupRepository.setWelcomeTemplate(chat.id, newTemplate);

    const response = [
      formatHeader("Summoning Incantation Inscribed"),
      `The arrival greeting for newly awakened souls has been recorded by ${formatUserMention(
        from.id,
        from.first_name,
        from.username
      )}.`,
      formatDivider(),
      `<i>New Beyonders entering the hall will receive this divine reception.</i>`,
    ].join("\n");

    await ctx.reply(response, { parse_mode: "HTML" });
    return;
  }

  // 2. Preview Summoning Welcome: /summoning or /summoning test
  const template = await groupRepository.getWelcomeTemplate(chat.id);
  const isSealed = await groupRepository.isChatSealed(chat.id);
  let memberCount = 1;
  try {
    memberCount = await ctx.getChatMemberCount();
  } catch {
    memberCount = 1;
  }

  const groupTitle = chat.title || "The Tarot Club";
  const preview = renderWelcomeTemplate(
    template,
    { id: from.id, firstName: from.first_name, username: from.username },
    groupTitle,
    memberCount,
    isSealed
  );

  const response = [
    preview,
    formatDivider(),
    `<i>[Summoning Rite Preview — Configurable via /summoning set &lt;text&gt;]</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
