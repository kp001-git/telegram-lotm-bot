import { MyContext } from "../../middlewares/context";
import { governanceRepository } from "../../database/repositories/governance.repository";
import { isShadowSovereign } from "../../config";
import { renderPollCard } from "./helpers";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function voteCommand(ctx: MyContext): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const subcommand = parts[1]?.toLowerCase();

  // 1. Council Subcommand: /vote create <Question> | <Opt1> | <Opt2> ...
  if (subcommand === "create") {
    const role = ctx.memberRole || "BEYONDER";
    if (
      !isShadowSovereign(from.id) &&
      role !== "CELESTIAL_WORTHY" &&
      role !== "THE_FOOL" &&
      role !== "THE_WORLD" &&
      role !== "THE_STAR"
    ) {
      await ctx.reply(
        "𓆩 Only High-Sequence Beyonders of the Council may initiate divine deliberations. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const payload = text.slice(text.indexOf("create") + 6).trim();
    const segments = payload
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (segments.length < 3) {
      await ctx.reply(
        "𓆩 Format: <code>/vote create Question | Option A | Option B [| Option C...]</code>\nRequires a question and at least two distinct options. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const question = segments[0];
    const options = segments.slice(1);

    if (options.length > 10) {
      await ctx.reply("𓆩 A single deliberation may hold at most 10 options. 𓆪", {
        parse_mode: "HTML",
      });
      return;
    }

    // Create poll in Turso
    const pollId = await governanceRepository.createPoll(chat.id, question, options, from.id);
    const pollWithTallies = await governanceRepository.getPollWithTallies(pollId);

    if (!pollWithTallies) {
      await ctx.reply("𓆩 Failed to formulate deliberation in the spirit world. 𓆪");
      return;
    }

    const card = renderPollCard(pollWithTallies);
    const sentMsg = await ctx.reply(card.text, {
      parse_mode: "HTML",
      reply_markup: card.reply_markup,
    });

    // Save message_id for real-time live edits
    await governanceRepository.updatePollMessageId(pollId, sentMsg.message_id);
    return;
  }

  // 2. Council Subcommand: /vote close <poll_id>
  if (subcommand === "close") {
    const role = ctx.memberRole || "BEYONDER";
    if (
      !isShadowSovereign(from.id) &&
      role !== "CELESTIAL_WORTHY" &&
      role !== "THE_FOOL" &&
      role !== "THE_WORLD" &&
      role !== "THE_STAR"
    ) {
      await ctx.reply(
        "𓆩 Only High-Sequence Beyonders of the Council may conclude deliberations. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const pollIdStr = parts[2];
    const pollId = parseInt(pollIdStr, 10);
    if (isNaN(pollId)) {
      await ctx.reply(
        "𓆩 Specify the poll ID to conclude: <code>/vote close &lt;poll_id&gt;</code> 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const poll = await governanceRepository.getPollById(pollId);
    if (!poll || poll.chat_id !== chat.id) {
      await ctx.reply(`𓆩 Deliberation #${pollId} was not found within this sanctuary. 𓆪`, {
        parse_mode: "HTML",
      });
      return;
    }

    if (poll.status === "CLOSED") {
      await ctx.reply(`𓆩 Deliberation #${pollId} has already concluded. 𓆪`, {
        parse_mode: "HTML",
      });
      return;
    }

    // Close poll
    await governanceRepository.closePoll(pollId);
    const finalPoll = await governanceRepository.getPollWithTallies(pollId);

    if (finalPoll) {
      const card = renderPollCard(finalPoll);
      // Attempt to edit original message if message_id exists
      if (finalPoll.message_id) {
        try {
          await ctx.api.editMessageText(chat.id, finalPoll.message_id, card.text, {
            parse_mode: "HTML",
          });
        } catch {
          // Fall through to reply
        }
      }

      await ctx.reply(
        `${formatHeader(`Council Deliberation #${pollId} Concluded`)}\n<b>Final Verdict:</b>\n${card.text}`,
        { parse_mode: "HTML" }
      );
    }
    return;
  }

  // 3. Member Subcommand: /vote (list active open polls)
  const activePolls = await governanceRepository.getActivePolls(chat.id);

  if (activePolls.length === 0) {
    await ctx.reply(
      "𓆩 There are no active council deliberations open in this sanctuary at this time. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  // Present each active poll ballot
  for (const poll of activePolls) {
    const card = renderPollCard(poll);
    await ctx.reply(card.text, {
      parse_mode: "HTML",
      reply_markup: card.reply_markup,
    });
  }
}
