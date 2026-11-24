import { MyContext } from "../../middlewares/context";
import { governanceRepository } from "../../database/repositories/governance.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function suggestionsCommand(ctx: MyContext): Promise<void> {
  const approved = await governanceRepository.getApprovedSuggestions(ctx.chat?.id, 15);

  if (approved.length === 0) {
    await ctx.reply(
      "𓆩 The ledger of approved decrees is currently pristine. Propose features via <code>/suggest</code>. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const entries = approved
    .map((item) => {
      const typeBadge = item.type === "IDEA" ? "[IDEA]" : "[FEATURE]";
      const author = item.author_first_name
        ? formatUserMention(item.user_id, item.author_first_name, item.author_username)
        : `Beyonder <code>${item.user_id}</code>`;

      const dateStr = item.created_at.slice(0, 10);
      return `• <b>#${item.id}</b> <code>${typeBadge}</code> by ${author} (<i>${dateStr}</i>)\n  ${escapeHtml(
        item.content
      )}`;
    })
    .join("\n\n");

  const response = [
    formatHeader("Approved Initiatives & Petitions Ledger"),
    `<i>The divine council has sanctioned the following proposals for implementation:</i>`,
    formatDivider(),
    entries,
    formatDivider(),
    `<i>"Approved under the divine mandate of the Celestial Worthy."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
