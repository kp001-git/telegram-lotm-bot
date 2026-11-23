import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { groupRepository } from "../../database/repositories/group.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function fateRecordsCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  if (!chat) return;

  const records = await userRepository.getFateRecords(chat.id);
  const isSealed = await groupRepository.isChatSealed(chat.id);

  const topList =
    records.topBeyonders.length > 0
      ? records.topBeyonders
          .map((u, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
            const pathwayStr = u.pathway ? `${escapeHtml(u.pathway)}` : "Mortal Seeker";
            const seqStr = `Seq ${u.sequence_level} (${pathwayStr})`;
            return `${medal} ${formatUserMention(u.user_id, u.first_name, u.username)} — <b>${
              u.messages_count
            }</b> messages [<i>${seqStr}</i>]`;
          })
          .join("\n")
      : " • <i>No activity inscribed yet</i>";

  const content = [
    formatHeader("The Ledger of Fate & Activity"),
    `<i>Statistical records retrieved from the spirit world ledger.</i>`,
    formatDivider(),
    `👥 <b>Tracked Beyonders:</b> <code>${records.totalBeyonders}</code> (Council: <code>${records.councilCount}</code> | Regular: <code>${records.standardBeyonders}</code>)`,
    `📜 <b>Messages Recorded:</b> <code>${records.totalMessages}</code>`,
    `🕯 <b>Prayers Offered:</b> <code>${records.totalPrayers}</code>`,
    `⚖ <b>Decrees Enacted:</b> <code>${records.totalDecrees}</code>`,
    `🔒 <b>Current Seal State:</b> <code>${isSealed ? "Sealed (Silent)" : "Unsealed (Vocal)"}</code>`,
    formatDivider(),
    `🏆 <b>Top Active Beyonders:</b>`,
    topList,
    formatDivider(),
    `<i>"Every word and action weaves the tapestry of destiny."</i>`,
  ].join("\n");

  await ctx.reply(content, { parse_mode: "HTML" });
}
