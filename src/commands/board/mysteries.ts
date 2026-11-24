import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { userRepository } from "../../database/repositories/user.repository";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function mysteriesCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  if (!chat) return;

  let memberCount = 0;
  try {
    memberCount = await ctx.getChatMemberCount();
  } catch {
    memberCount = 0;
  }

  const isSealed = await groupRepository.isChatSealed(chat.id);
  const councilMembers = await userRepository.getCouncilMembers(chat.id);

  const title = chat.title || "The Divine Hall";
  const sealBadge = isSealed
    ? "🔒 <b>Sealed by Ancient Fog</b> (Council Speech Only)"
    : "🔓 <b>Sanctuary Open</b> (Mortal Whispers Permitted)";

  const content = [
    formatHeader("Sanctuary Overview of Mysteries"),
    `<b>Domain:</b> ${escapeHtml(title)}`,
    `<b>Sanctuary ID:</b> <code>${chat.id}</code>`,
    `<b>Assembled Beyonders:</b> <code>${memberCount}</code>`,
    `<b>Sanctuary Barrier:</b> ${sealBadge}`,
    formatDivider(),
    `🏛 <b>Active Council Hierarchy (${councilMembers.length} Seats Filled):</b>`,
    councilMembers.length > 0
      ? councilMembers.map((m) => ` • <b>${escapeHtml(m.role)}:</b> ${escapeHtml(m.first_name)}`).join("\n")
      : " • <i>No council seats assigned yet</i>",
    formatDivider(),
    `<b>Ledger Engine:</b> <code>libSQL / Turso Cloud Engine</code>`,
    `<i>"We look at the stars from above the Grey Fog."</i>`,
  ].join("\n");

  await ctx.reply(content, { parse_mode: "HTML" });
}
