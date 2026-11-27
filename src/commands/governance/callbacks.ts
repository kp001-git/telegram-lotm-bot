import { Bot } from "grammy";
import { MyContext } from "../../middlewares/context";
import { governanceRepository } from "../../database/repositories/governance.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { resolveUserRole } from "../../utils/resolver";
import { isShadowSovereign } from "../../config";
import { renderPollCard } from "./helpers";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export function registerGovernanceCallbacks(bot: Bot<MyContext>): void {
  // 1. Council Review Card Actions: gov:(approve|reject|vote):<id>
  bot.callbackQuery(/^gov:(approve|reject|vote):(\d+)$/, async (ctx) => {
    const match = ctx.match;
    const action = match[1];
    const submissionId = parseInt(match[2], 10);
    const from = ctx.from;
    const chat = ctx.chat;

    if (!from || !chat) {
      await ctx.answerCallbackQuery();
      return;
    }

    const role = await resolveUserRole(ctx, from.id);
    const isShadow = isShadowSovereign(from.id);

    const submission = await governanceRepository.getSubmissionById(submissionId);
    if (!submission) {
      await ctx.answerCallbackQuery({
        text: "𓆩 Dossier not found in the spirit world. 𓆪",
        show_alert: true,
      });
      return;
    }

    // A. APPROVAL (CELESTIAL_WORTHY, or THE_FOOL)
    if (action === "approve") {
      if (!isShadow && role !== "CELESTIAL_WORTHY" && role !== "THE_FOOL") {
        await ctx.answerCallbackQuery({
          text: "𓆩 Only The Celestial Worthy holds final approval authority. 𓆪",
          show_alert: true,
        });
        return;
      }

      await governanceRepository.updateSubmissionStatus(submissionId, "APPROVED", from.id);

      await auditRepository.logAndMirror(ctx.api, {
        chat_id: chat.id,
        actor_id: from.id,
        action: "APPROVE_SUBMISSION",
        reason: `Approved Dossier #${submissionId} (${submission.type})`,
      });

      const updatedText = [
        formatHeader(`Council Review Dossier #${submission.id}`),
        `<b>Classification:</b> <code>${submission.type}</code>`,
        `<b>Inscribed Content:</b>\n<i>${escapeHtml(submission.content)}</i>`,
        formatDivider(),
        `👑 <b>Status:</b> <b>APPROVED</b> by ${formatUserMention(
          from.id,
          from.first_name,
          from.username
        )}`,
        `<i>Sanctioned under the mandate of the Celestial Worthy.</i>`,
      ].join("\n");

      try {
        await ctx.editMessageText(updatedText, { parse_mode: "HTML" });
      } catch {
        // Ignore edit error if identical
      }

      await ctx.answerCallbackQuery({ text: "𓆩 Petition Approved. 𓆪" });
      return;
    }

    // B. REJECTION (CELESTIAL_WORTHY, THE_FOOL, THE_WORLD)
    if (action === "reject") {
      if (!isShadow && role !== "CELESTIAL_WORTHY" && role !== "THE_FOOL" && role !== "THE_WORLD") {
        await ctx.answerCallbackQuery({
          text: "𓆩 The Grey Fog blocks your path. High-Sequence Council rank required. 𓆪",
          show_alert: true,
        });
        return;
      }

      await governanceRepository.updateSubmissionStatus(submissionId, "REJECTED", from.id);

      await auditRepository.logAndMirror(ctx.api, {
        chat_id: chat.id,
        actor_id: from.id,
        action: "REJECT_SUBMISSION",
        reason: `Dismissed Dossier #${submissionId} (${submission.type})`,
      });

      const updatedText = [
        formatHeader(`Council Review Dossier #${submission.id}`),
        `<b>Classification:</b> <code>${submission.type}</code>`,
        `<b>Inscribed Content:</b>\n<i>${escapeHtml(submission.content)}</i>`,
        formatDivider(),
        `🌑 <b>Status:</b> <b>DISMISSED / REJECTED</b> by ${formatUserMention(
          from.id,
          from.first_name,
          from.username
        )}`,
        `<i>The petition failed to pass council scrutiny.</i>`,
      ].join("\n");

      try {
        await ctx.editMessageText(updatedText, { parse_mode: "HTML" });
      } catch {
        // Ignore edit error
      }

      await ctx.answerCallbackQuery({ text: "𓆩 Petition Dismissed. 𓆪" });
      return;
    }

    // C. SEND TO VOTE (CELESTIAL_WORTHY, THE_FOOL, THE_WORLD, THE_STAR)
    if (action === "vote") {
      if (
        !isShadow &&
        role !== "CELESTIAL_WORTHY" &&
        role !== "THE_FOOL" &&
        role !== "THE_WORLD" &&
        role !== "THE_STAR"
      ) {
        await ctx.answerCallbackQuery({
          text: "𓆩 Council rank required to initiate community deliberation. 𓆪",
          show_alert: true,
        });
        return;
      }

      await governanceRepository.updateSubmissionStatus(submissionId, "VOTING", from.id);

      // Create a community poll
      const question = `Community Ballot: ${submission.content.slice(0, 100)}`;
      const options = ["For (Agree)", "Against (Disagree)"];

      const pollId = await governanceRepository.createPoll(
        chat.id,
        question,
        options,
        from.id,
        submissionId
      );

      const pollWithTallies = await governanceRepository.getPollWithTallies(pollId);

      if (pollWithTallies) {
        const card = renderPollCard(pollWithTallies);
        const sentPoll = await ctx.reply(card.text, {
          parse_mode: "HTML",
          reply_markup: card.reply_markup,
        });
        await governanceRepository.updatePollMessageId(pollId, sentPoll.message_id);
      }

      const updatedText = [
        formatHeader(`Council Review Dossier #${submission.id}`),
        `<b>Classification:</b> <code>${submission.type}</code>`,
        `<b>Inscribed Content:</b>\n<i>${escapeHtml(submission.content)}</i>`,
        formatDivider(),
        `⚖️ <b>Status:</b> <b>TRANSFERRED TO DELIBERATION</b> (Poll #${pollId})`,
        `<i>Initiated by ${formatUserMention(from.id, from.first_name, from.username)}</i>`,
      ].join("\n");

      try {
        await ctx.editMessageText(updatedText, { parse_mode: "HTML" });
      } catch {
        // Ignore edit error
      }

      await ctx.answerCallbackQuery({ text: "𓆩 Community ballot initiated. 𓆪" });
      return;
    }

    await ctx.answerCallbackQuery();
  });

  // 2. Interactive Poll Voting: poll:cast:<poll_id>:<option_index>
  bot.callbackQuery(/^poll:cast:(\d+):(\d+)$/, async (ctx) => {
    const match = ctx.match;
    const pollId = parseInt(match[1], 10);
    const optionIndex = parseInt(match[2], 10);
    const from = ctx.from;

    if (!from) {
      await ctx.answerCallbackQuery();
      return;
    }

    const poll = await governanceRepository.getPollById(pollId);
    if (!poll || poll.status === "CLOSED") {
      await ctx.answerCallbackQuery({
        text: "𓆩 This deliberation has closed. 𓆪",
        show_alert: true,
      });
      return;
    }

    // Cast vote (upsert guarantees 1 vote per member and allows switching)
    await governanceRepository.castVote(pollId, from.id, optionIndex);

    await ctx.answerCallbackQuery({
      text: "𓆩 Your whisper of fate has been recorded above the Grey Fog. 𓆪",
    });

    // Update message tallies in real-time
    const updated = await governanceRepository.getPollWithTallies(pollId);
    if (updated) {
      const card = renderPollCard(updated);
      try {
        await ctx.editMessageText(card.text, {
          parse_mode: "HTML",
          reply_markup: card.reply_markup,
        });
      } catch {
        // If message not modified, ignore
      }
    }
  });
}
