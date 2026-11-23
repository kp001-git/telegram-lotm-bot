import { InlineKeyboard } from "grammy";
import { PollWithTallies, Submission } from "../../database/repositories/governance.repository";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

/**
 * Renders visual ASCII progress bar for votes: e.g. [██████░░░░] 60%
 */
export function renderProgressBar(percentage: number, totalBlocks = 10): string {
  const filledBlocks = Math.round((percentage / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const filled = "█".repeat(Math.max(0, filledBlocks));
  const empty = "░".repeat(Math.max(0, emptyBlocks));
  return `<code>[${filled}${empty}]</code>`;
}

/**
 * Formats a poll ballot card and generates interactive inline buttons.
 */
export function renderPollCard(poll: PollWithTallies): {
  text: string;
  reply_markup: InlineKeyboard;
} {
  const isClosed = poll.status === "CLOSED";
  const header = isClosed
    ? formatHeader(`Deliberation #${poll.id} [Closed]`)
    : formatHeader(`Council Deliberation #${poll.id}`);

  const talliesText = poll.tallies
    .map((t) => {
      const bar = renderProgressBar(t.percentage);
      return `<b>${escapeHtml(t.text)}</b>\n${bar} <b>${t.percentage}%</b> (<code>${t.count}</code> votes)`;
    })
    .join("\n\n");

  const statusText = isClosed
    ? `🔒 <b>Status:</b> Closed / Final Determination Recorded`
    : `🗳 <b>Status:</b> Active Community Deliberation`;

  const text = [
    header,
    `<b>Question:</b> ${escapeHtml(poll.question)}`,
    formatDivider(),
    talliesText,
    formatDivider(),
    `<b>Total Whispers (Votes):</b> <code>${poll.totalVotes}</code>`,
    statusText,
    `<i>"Every choice echoes in the historical void."</i>`,
  ].join("\n");

  const keyboard = new InlineKeyboard();

  if (!isClosed) {
    // Generate voting buttons
    poll.options.forEach((opt, idx) => {
      // 2 buttons per row if more than 2 options
      keyboard.text(opt, `poll:cast:${poll.id}:${idx}`);
      if (idx % 2 === 1 && idx < poll.options.length - 1) {
        keyboard.row();
      }
    });
  }

  return { text, reply_markup: keyboard };
}

/**
 * Formats an interactive review card for Council evaluation.
 */
export function renderCouncilReviewCard(
  submission: Submission,
  author?: { id: number; firstName: string; username?: string | null }
): { text: string; reply_markup: InlineKeyboard } {
  const typeBadge =
    submission.type === "SUGGESTION"
      ? "💡 <b>Feature Proposal</b>"
      : submission.type === "IDEA"
      ? "✨ <b>Community Initiative</b>"
      : "⚠️ <b>Anomaly Report</b>";

  const authorMention = author
    ? formatUserMention(author.id, author.firstName, author.username)
    : `Beyonder <code>${submission.user_id}</code>`;

  const text = [
    formatHeader(`Council Review Dossier #${submission.id}`),
    `<b>Classification:</b> ${typeBadge}`,
    `<b>Petitioner:</b> ${authorMention}`,
    `<b>Date:</b> <code>${submission.created_at.slice(0, 19).replace("T", " ")}</code>`,
    formatDivider(),
    `<b>Inscribed Content:</b>\n<i>${escapeHtml(submission.content)}</i>`,
    formatDivider(),
    `<b>Status:</b> <code>${submission.status}</code>`,
    `<i>Select an administrative decree below:</i>`,
  ].join("\n");

  const keyboard = new InlineKeyboard();

  if (submission.type === "REPORT") {
    keyboard
      .text("✅ Mark Resolved", `gov:approve:${submission.id}`)
      .text("🗑 Dismiss", `gov:reject:${submission.id}`);
  } else {
    keyboard
      .text("⚖️ Send to Vote", `gov:vote:${submission.id}`)
      .text("👑 Final Approve", `gov:approve:${submission.id}`)
      .row()
      .text("🌑 Reject", `gov:reject:${submission.id}`);
  }

  return { text, reply_markup: keyboard };
}
