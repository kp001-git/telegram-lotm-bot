import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import pathwaysData from "../../data/pathways.json";
import { findPathway, PathwayData } from "./pathway";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function sequenceCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);

  // 1. /sequence <0-9> or /sequence <pathway> <0-9>
  if (parts.length > 1) {
    let targetLevel: number | undefined;
    let targetPathway: PathwayData | undefined;

    // Check if single numeric arg: /sequence 7
    if (/^\d$/.test(parts[1])) {
      targetLevel = parseInt(parts[1], 10);
    } else if (parts.length > 2 && /^\d$/.test(parts[2])) {
      // /sequence Fool 7
      targetPathway = findPathway(parts[1]);
      targetLevel = parseInt(parts[2], 10);
    } else {
      // /sequence Fool -> default level 9
      targetPathway = findPathway(parts[1]);
    }

    if (targetPathway && targetLevel !== undefined) {
      const seqTitle = targetPathway.sequences[targetLevel.toString()] || "Unknown";
      const notes = targetPathway.potion_notes?.[`seq${targetLevel}`] || "Acting principles guarded.";

      const response = [
        formatHeader(`${targetPathway.name} — Sequence ${targetLevel}`),
        `<b>Title:</b> <b>${escapeHtml(seqTitle)}</b>`,
        `<b>Domain:</b> ${escapeHtml(targetPathway.group)}`,
        formatDivider(),
        `<b>Potion & Acting Guidance:</b>\n<i>${escapeHtml(notes)}</i>`,
      ].join("\n");

      await ctx.reply(response, { parse_mode: "HTML" });
      return;
    }

    if (targetLevel !== undefined) {
      const tierDescription =
        targetLevel >= 8
          ? "<b>Low Sequence (9–8):</b> Mortal transcendence. Basic spiritual perception and physical adjustments."
          : targetLevel >= 5
          ? "<b>Mid Sequence (7–5):</b> Supernatural qualitative leap. Core magical abilities and spiritual mastery."
          : targetLevel >= 3
          ? "<b>High Sequence / Demigod & Saint (4–3):</b> Incomplete mythical creature form. Divinity and godhood begin to manifest."
          : targetLevel >= 1
          ? "<b>Angelic Realm (2–1):</b> Grounded Angel. Complete mythical creature form and authority over miracles."
          : "<b>True Deity (Sequence 0):</b> Supreme godhood governing the universal concepts of the pathway.";

      const response = [
        formatHeader(`Beyonder Hierarchy — Sequence ${targetLevel}`),
        tierDescription,
        formatDivider(),
        `<i>Inspect a specific path: <code>/sequence &lt;pathway&gt; ${targetLevel}</code></i>`,
      ].join("\n");

      await ctx.reply(response, { parse_mode: "HTML" });
      return;
    }
  }

  // 2. Default: Caller's Sequence Profile + 9-to-0 Hierarchy Overview
  const dbUser = await userRepository.getUserById(from.id);
  const pathwayName = dbUser?.pathway || "Uninitiated (Mortal)";
  const seqLevel = dbUser?.sequence_level ?? 9;

  let currentTitle = "Initiate";
  if (dbUser?.pathway) {
    const p = findPathway(dbUser.pathway);
    if (p) {
      currentTitle = p.sequences[seqLevel.toString()] || "Initiate";
    }
  }

  const response = [
    formatHeader("Beyonder Sequence Hierarchy"),
    `<b>Beyonder:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    `<b>Pathway:</b> <b>${escapeHtml(pathwayName)}</b>`,
    `<b>Current Rank:</b> Sequence <b>${seqLevel}</b> — <i>${escapeHtml(currentTitle)}</i>`,
    formatDivider(),
    `🏛 <b>The 9-to-0 Sequence Progression:</b>`,
    ` • <b>Seq 9–8:</b> Low Sequence (Mortal Awakening)`,
    ` • <b>Seq 7–5:</b> Mid Sequence (Supernatural Essence)`,
    ` • <b>Seq 4–3:</b> Demigod & Saint (Incomplete Mythical Creature)`,
    ` • <b>Seq 2–1:</b> Angel & Archangel (Complete Mythical Form)`,
    ` • <b>Seq 0:</b> True Deity (Divine Throne of the Pathway)`,
    formatDivider(),
    `<i>Inquire specific sequence details: <code>/sequence &lt;level&gt;</code></i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
