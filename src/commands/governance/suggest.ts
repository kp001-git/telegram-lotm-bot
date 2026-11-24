import { MyContext } from "../../middlewares/context";
import {
  governanceRepository,
  SubmissionType,
} from "../../database/repositories/governance.repository";
import { config } from "../../config";
import { renderCouncilReviewCard } from "./helpers";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function handleSubmission(
  ctx: MyContext,
  type: SubmissionType
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const content = parts.slice(1).join(" ").trim();

  const commandName = type === "SUGGESTION" ? "suggest" : type === "IDEA" ? "idea" : "report";

  if (!content || content.length < 8) {
    await ctx.reply(
      `𓆩 Provide a detailed description (minimum 8 characters):\n<code>/${commandName} &lt;your description here&gt;</code> 𓆪`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 1. Create submission in Turso
  const submissionId = await governanceRepository.createSubmission(from.id, type, content, ctx.chat?.id);

  const typeLabel =
    type === "SUGGESTION"
      ? "Feature Suggestion"
      : type === "IDEA"
      ? "Community Idea"
      : "Anomaly Report";

  // 2. Reply to petitioner with receipt
  const receipt = [
    formatHeader(`${typeLabel} Inscribed`),
    `Your petition has been delivered to the Tarot Club Council under Dossier #<b>${submissionId}</b>.`,
    `\n<b>Content:</b> <i>${escapeHtml(content)}</i>`,
    formatDivider(),
    `<i>"The Council reviews all petitions under the law of Equivalent Exchange."</i>`,
  ].join("\n");

  await ctx.reply(receipt, { parse_mode: "HTML" });

  // 3. Forward interactive Review Card to ADMIN_LOG_CHAT_ID (or current chat)
  const submission = await governanceRepository.getSubmissionById(submissionId);
  if (submission) {
    const card = renderCouncilReviewCard(submission, {
      id: from.id,
      firstName: from.first_name,
      username: from.username,
    });

    const targetChat = config.adminLogChatId || (ctx.chat?.id ? ctx.chat.id : undefined);
    if (targetChat) {
      try {
        await ctx.api.sendMessage(targetChat, card.text, {
          parse_mode: "HTML",
          reply_markup: card.reply_markup,
        });
      } catch (err: any) {
        console.error(`[governance] Failed to forward review card to ${targetChat}:`, err?.message);
      }
    }
  }
}

export async function suggestCommand(ctx: MyContext): Promise<void> {
  await handleSubmission(ctx, "SUGGESTION");
}
