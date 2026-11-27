import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { calculateSequenceLevel, getSequenceTitle } from "../../utils/sequences";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function leaderboardCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  if (!chat) return;

  const leaders = await userRepository.getGroupLeaderboard(chat.id, 10);

  if (leaders.length === 0) {
    await ctx.reply(
      "𓆩 No Beyonders have been inscribed in this sanctuary's ledger yet. Speak or offer a /prayer to awaken! 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const lines = leaders.map((member, index) => {
    const rankNum = index + 1;
    const rankBadge =
      rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : rankNum === 3 ? "🥉" : `<b>#${rankNum}</b>`;

    const xp = Number(member.spirituality_xp ?? 0);
    const seqLevel = calculateSequenceLevel(xp);
    const seqTitle = getSequenceTitle(member.pathway, seqLevel);
    const pathwayLabel = member.pathway ? escapeHtml(member.pathway) : "Unaligned";

    const badges: string[] = [];
    if (member.role && member.role !== "BEYONDER") {
      badges.push(escapeHtml(member.role.replace(/_/g, " ")));
    }
    if (member.custom_position) {
      badges.push(escapeHtml(member.custom_position));
    }
    const badgeStr = badges.length > 0 ? ` <i>[${badges.join(" • ")}]</i>` : "";

    return `${rankBadge} <b>${escapeHtml(member.first_name)}</b>${badgeStr}\n    ↳ <code>${pathwayLabel}</code> • ${escapeHtml(seqTitle)} (<b>${xp} XP</b>)`;
  });

  const response = [
    formatHeader("Sanctuary Sequence Leaderboard"),
    `<i>The only 10 Beyonders in ${escapeHtml(chat.title || "this sanctuary")} actually pulling their weight:</i>`,
    formatDivider(),
    lines.join("\n\n"),
    formatDivider(),
    `<i>Not on the list? Stop lurking and grind XP via active presence, /prayer (+25 XP), or /ritual (+40 XP).</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
