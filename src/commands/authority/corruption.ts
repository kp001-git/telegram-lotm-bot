import { MyContext } from "../../middlewares/context";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { resolveTargetAndArgs } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function corruptionCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target } = await resolveTargetAndArgs(ctx);
  const role = ctx.memberRole || "BEYONDER";
  const isCouncil =
    role === "CELESTIAL_WORTHY" ||
    role === "THE_FOOL" ||
    role === "THE_WORLD" ||
    role === "THE_STAR";

  let targetId = from.id;
  let targetName = from.first_name;
  let targetUsername = from.username;

  if (target && target.userId !== from.id) {
    if (!isCouncil) {
      await ctx.reply(
        "𓆩 Only High-Sequence Council members may inspect another Beyonder's corruption ledger. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }
    targetId = target.userId;
    targetName = target.firstName || "Beyonder";
    targetUsername = target.username ?? undefined;
  }

  const records = await defenseRepository.getCorruptions(chat.id, targetId);
  const wardConfig = await defenseRepository.getWardConfig(chat.id);
  const warnLimit = wardConfig.warn_limit;

  if (records.length === 0) {
    const cleanMsg = [
      formatHeader("Spirit Body Inspection"),
      `🕯 ${formatUserMention(targetId, targetName, targetUsername)} bears <code>[0/${warnLimit}]</code> corruption marks.`,
      formatDivider(),
      `<i>Their spirit body remains pure and unblemished.</i>`,
    ].join("\n");

    await ctx.reply(cleanMsg, { parse_mode: "HTML" });
    return;
  }

  const list = records
    .map((rec, idx) => {
      const dateStr = rec.created_at ? rec.created_at.slice(0, 10) : "Unknown";
      const reasonStr = escapeHtml(rec.reason || "Unspecified transgression");
      return `<b>${idx + 1}.</b> ${reasonStr} <i>(${dateStr})</i>`;
    })
    .join("\n");

  const response = [
    formatHeader("Spirit Body Corruption Ledger"),
    `<b>Beyonder:</b> ${formatUserMention(targetId, targetName, targetUsername)}`,
    `<b>Corruption Level:</b> <code>[${records.length}/${warnLimit}]</code>`,
    formatDivider(),
    list,
    formatDivider(),
    `<i>Reaching [${warnLimit}/${warnLimit}] triggers Loss of Control (${wardConfig.warn_punishment}).</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
