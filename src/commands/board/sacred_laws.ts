import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function sacredLawsCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const action = parts[1]?.toLowerCase();

  // Admin Override: /sacred_laws set <new_laws>
  if (action === "set") {
    const role = ctx.memberRole || "BEYONDER";
    if (role !== "CELESTIAL_WORTHY" && role !== "THE_FOOL") {
      await ctx.reply(
        "𓆩 The Grey Fog blocks your path. Only High-Sequence Beyonders of the Council may amend the Sacred Laws. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const newLaws = parts.slice(2).join(" ").trim();
    if (!newLaws) {
      await ctx.reply(
        "𓆩 Specify the new decrees to encode into the Sacred Laws:\n<code>/sacred_laws set &lt;decrees text&gt;</code> 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    await groupRepository.setSacredLaws(chat.id, newLaws);

    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      action: "UPDATE_SACRED_LAWS",
      reason: "Amended Sacred Laws decree",
    });

    const response = [
      formatHeader("Sacred Laws Amended"),
      `The divine decrees of the Tarot Club have been inscribed into the ledger by ${formatUserMention(
        from.id,
        from.first_name,
        from.username
      )}.`,
      formatDivider(),
      `<i>All Beyonders within this sanctuary must adhere to the new mandate.</i>`,
    ].join("\n");

    await ctx.reply(response, { parse_mode: "HTML" });
    return;
  }

  // Default: Display Sacred Laws
  const laws = await groupRepository.getSacredLaws(chat.id);
  const response = [
    formatHeader("The Sacred Laws of the Tarot Club"),
    laws,
    formatDivider(),
    `<i>"Equivalent Exchange is the foundation. Knowledge without anchor leads to madness."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
