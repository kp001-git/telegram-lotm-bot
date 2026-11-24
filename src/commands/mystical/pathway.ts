import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { userCache } from "../../middlewares/cache";
import pathwaysData from "../../data/pathways.json";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export interface PathwayData {
  name: string;
  group: string;
  symbol: string;
  authority: string;
  sequences: Record<string, string>;
  potion_notes?: Record<string, string>;
}

export function findPathway(query: string): PathwayData | undefined {
  const clean = query.trim().toLowerCase().replace(/pathway$/, "").trim();
  return (pathwaysData as PathwayData[]).find((p) => {
    const pName = p.name.toLowerCase().replace(/pathway$/, "").trim();
    return pName === clean || pName.includes(clean) || clean.includes(pName);
  });
}

export async function pathwayCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const action = parts[1]?.toLowerCase();

  // 1. /pathway choose <name>
  if (action === "choose") {
    const targetName = parts.slice(2).join(" ").trim();
    if (!targetName) {
      await ctx.reply(
        "𓆩 Specify the pathway you wish to embrace:\n<code>/pathway choose &lt;pathway name&gt;</code>\nExample: <code>/pathway choose Fool</code> 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const pathway = findPathway(targetName);
    if (!pathway) {
      await ctx.reply(
        `𓆩 The spirit world does not recognize '${escapeHtml(targetName)}'. Inquire via <code>/pathway</code> to view the 22 canonical paths. 𓆪`,
        { parse_mode: "HTML" }
      );
      return;
    }

    await userRepository.setUserPathway(from.id, pathway.name, ctx.chat?.id);
    userCache.invalidate(ctx.chat?.id, from.id);

    const seq9Name = pathway.sequences["9"] || "Initiate";

    const response = [
      formatHeader("Beyonder Initiation Confirmed"),
      `${formatUserMention(from.id, from.first_name, from.username)} has consumed the initiation potion of the <b>${escapeHtml(
        pathway.name
      )}</b>.`,
      `\n<b>Current Rank:</b> Sequence 9 — <b>${escapeHtml(seq9Name)}</b>`,
      `<b>Above-the-Sequence Domain:</b> <i>${escapeHtml(pathway.group)}</i>`,
      `<b>Core Authority:</b> ${escapeHtml(pathway.authority)}`,
      formatDivider(),
      `<i>"Digest your potion with care. Act in accordance with your sequence name."</i>`,
    ].join("\n");

    await ctx.reply(response, { parse_mode: "HTML" });
    return;
  }

  // 2. /pathway <name> (Detailed Dossier)
  if (parts.length > 1 && action !== "choose") {
    const query = parts.slice(1).join(" ").trim();
    const pathway = findPathway(query);

    if (!pathway) {
      await ctx.reply(
        `𓆩 Pathway '${escapeHtml(query)}' not found. Run <code>/pathway</code> to view all 22 pathways. 𓆪`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const sequenceLadder = Object.entries(pathway.sequences)
      .sort((a, b) => parseInt(b[0], 10) - parseInt(a[0], 10))
      .map(([lvl, title]) => ` • <b>Sequence ${lvl}:</b> ${escapeHtml(title)}`)
      .join("\n");

    const notes = pathway.potion_notes
      ? Object.entries(pathway.potion_notes)
          .map(([k, v]) => ` • <b>${k.toUpperCase()}:</b> <i>${escapeHtml(v)}</i>`)
          .join("\n")
      : " • <i>Potion formulas safeguarded in Blasphemy Slates.</i>";

    const response = [
      formatHeader(pathway.name),
      `<b>Above-the-Sequence Domain:</b> <i>${escapeHtml(pathway.group)}</i>`,
      `<b>Esoteric Symbol:</b> ${escapeHtml(pathway.symbol)}`,
      `<b>Divine Authority:</b> ${escapeHtml(pathway.authority)}`,
      formatDivider(),
      `📜 <b>Sequence Progression Ladder:</b>\n${sequenceLadder}`,
      formatDivider(),
      `🧪 <b>Potion & Acting Guidance:</b>\n${notes}`,
      formatDivider(),
      `<i>To bind yourself to this path: <code>/pathway choose ${escapeHtml(
        pathway.name.replace(/ Pathway$/, "")
      )}</code></i>`,
    ].join("\n");

    await ctx.reply(response, { parse_mode: "HTML" });
    return;
  }

  // 3. /pathway (Compact Directory of all 22 grouped pathways + caller's profile)
  const dbUser = await userRepository.getUserById(from.id);
  const currentPathway = dbUser?.pathway || "Uninitiated (Mortal)";
  const currentSeq = dbUser?.sequence_level ?? 9;

  // Group pathways by domain
  const groups: Record<string, string[]> = {};
  for (const p of pathwaysData as PathwayData[]) {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p.name.replace(/ Pathway$/, ""));
  }

  const groupText = Object.entries(groups)
    .map(([groupName, paths]) => `👑 <b>${escapeHtml(groupName)}:</b>\n  <code>${paths.join(" • ")}</code>`)
    .join("\n\n");

  const response = [
    formatHeader("The 22 Canonical Pathways of the Cosmos"),
    `<b>Your Bound Path:</b> <b>${escapeHtml(currentPathway)}</b> (Sequence ${currentSeq})`,
    formatDivider(),
    groupText,
    formatDivider(),
    `<b>Inspect Dossier:</b> <code>/pathway &lt;name&gt;</code>`,
    `<b>Bind Pathway:</b> <code>/pathway choose &lt;name&gt;</code>`,
    `<i>"The Blasphemy Slate contains the complete ladder of the gods."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
