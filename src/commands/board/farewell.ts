import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

const moderationRemovals = new Map<string, number>();

export function markModerationRemoval(chatId: number, userId: number): void {
  moderationRemovals.set(`${chatId}:${userId}`, Date.now() + 30_000);
}

export function consumeModerationRemoval(chatId: number, userId: number): boolean {
  const key = `${chatId}:${userId}`;
  const expiresAt = moderationRemovals.get(key);
  if (!expiresAt) return false;
  moderationRemovals.delete(key);
  return Date.now() < expiresAt;
}

/**
 * Replaces placeholders {mention}, {name}, {group}, {count} in the farewell template.
 */
export function renderFarewellTemplate(
  template: string,
  user: { id: number; firstName: string; username?: string | null },
  groupTitle: string,
  memberCount: number
): string {
  const mention = formatUserMention(user.id, user.firstName, user.username);
  return template
    .replace(/\{mention\}/g, mention)
    .replace(/\{name\}/g, escapeHtml(user.firstName))
    .replace(/\{group\}/g, escapeHtml(groupTitle))
    .replace(/\{count\}/g, memberCount.toString());
}

export async function farewellCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const action = parts[1]?.toLowerCase();

  // 1. Toggle Goodbye Gateway: /farewell on | off
  if (action === "on" || action === "off") {
    const enabled = action === "on";
    await groupRepository.setGoodbyeEnabled(chat.id, enabled);

    await ctx.reply(
      [
        formatHeader(enabled ? "Farewell Gateway Opened" : "Farewell Gateway Sealed"),
        enabled
          ? `🕯 Departure farewells are now <b>ACTIVE</b> when Beyonders leave this sanctuary.`
          : `⭕ Departure farewells are now <b>DORMANT</b>.`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  // 2. Customize Template: /farewell set <template>
  if (action === "set") {
    const newTemplate = parts.slice(2).join(" ").trim();
    if (!newTemplate) {
      await ctx.reply(
        "𓆩 Specify the farewell template:\n<code>/farewell set &lt;template&gt;</code>\n\n<b>Placeholders:</b>\n • <code>{mention}</code> — User tag\n • <code>{name}</code> — First name\n • <code>{group}</code> — Sanctuary name\n • <code>{count}</code> — Remaining member count 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    await groupRepository.setGoodbyeTemplate(chat.id, newTemplate);

    const response = [
      formatHeader("Farewell Incantation Inscribed"),
      `The departure rite for leaving Beyonders has been recorded by ${formatUserMention(
        from.id,
        from.first_name,
        from.username
      )}.`,
      formatDivider(),
      `<i>Departing members will receive this final blessing.</i>`,
    ].join("\n");

    await ctx.reply(response, { parse_mode: "HTML" });
    return;
  }

  // 3. Preview / Test Farewell: /farewell or /farewell test
  const goodbyeConfig = await groupRepository.getGoodbyeConfig(chat.id);
  let memberCount = 1;
  try {
    memberCount = await ctx.getChatMemberCount();
  } catch {
    memberCount = 1;
  }

  const groupTitle = chat.title || "The Tarot Club";
  const preview = renderFarewellTemplate(
    goodbyeConfig.template,
    { id: from.id, firstName: from.first_name, username: from.username },
    groupTitle,
    memberCount
  );

  const statusText = goodbyeConfig.enabled ? "ACTIVE" : "DORMANT";
  const response = [
    preview,
    formatDivider(),
    `<i>[Farewell Gateway: <b>${statusText}</b> — /farewell on|off | /farewell set &lt;text&gt;]</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
