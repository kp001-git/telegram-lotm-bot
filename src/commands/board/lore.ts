import { MyContext } from "../../middlewares/context";
import { groupRepository } from "../../database/repositories/group.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, formatUserMention } from "../../utils/formatters";

export async function loreCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const action = parts[1]?.toLowerCase();

  // Admin Override: /lore set <new_lore>
  if (action === "set") {
    const role = ctx.memberRole || "BEYONDER";
    if (role !== "CELESTIAL_WORTHY" && role !== "THE_FOOL") {
      await ctx.reply(
        "𓆩 The Grey Fog blocks your path. Only High-Sequence Beyonders of the Council may revise the Chronicles. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const newLore = parts.slice(2).join(" ").trim();
    if (!newLore) {
      await ctx.reply(
        "𓆩 Specify the chronicles to record:\n<code>/lore set &lt;lore text&gt;</code> 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    await groupRepository.setLore(chat.id, newLore);

    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      action: "UPDATE_LORE",
      reason: "Revised sanctuary chronicles",
    });

    const response = [
      formatHeader("Chronicles Inscribed"),
      `The mystical history and ethos of this domain have been revised by ${formatUserMention(
        from.id,
        from.first_name,
        from.username
      )}.`,
      formatDivider(),
      `<i>The memory of the Divine Hall is preserved.</i>`,
    ].join("\n");

    await ctx.reply(response, { parse_mode: "HTML" });
    return;
  }

  // Default: Display Chronicles
  const lore = await groupRepository.getLore(chat.id);
  const response = [
    formatHeader("Chronicles of the Grey Fog"),
    lore,
    formatDivider(),
    `<i>"The crimson light summons those destined to witness the mysteries."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
