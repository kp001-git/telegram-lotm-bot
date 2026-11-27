import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { userCache } from "../../middlewares/cache";
import { resolveTargetAndArgs } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";

export async function bestowCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, rawReason } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username and the honorific title:\n<code>/bestow &lt;title | clear&gt;</code> 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const titleInput = rawReason.trim();
  if (!titleInput) {
    await ctx.reply(
      "𓆩 Provide an honorific position title or <code>clear</code>:\n<code>/bestow Tarot Envoy</code> 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  if (titleInput.toLowerCase() === "clear") {
    await userRepository.setMemberPosition(chat.id, target.userId, null);
    userCache.invalidate(chat.id, target.userId);

    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      target_id: target.userId,
      action: "BESTOW_CLEAR",
      reason: "Cleared custom honorific position",
    });

    await ctx.reply(
      [
        formatHeader("Honorific Position Revoked"),
        `The custom position held by ${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has been cleared.`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  if (titleInput.length > 40) {
    await ctx.reply(
      "𓆩 An honorific position title must be 40 characters or fewer. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  await userRepository.setMemberPosition(chat.id, target.userId, titleInput);
  userCache.invalidate(chat.id, target.userId);

  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "BESTOW",
    reason: `Bestowed honorific position: ${titleInput}`,
  });

  const response = [
    formatHeader("Honorific Position Bestowed"),
    `🏅 ${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has been granted the honorific title:`,
    `\n<b>𓆩 ${escapeHtml(titleInput)} 𓆪</b>`,
    `\n<b>Bestowed by:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>This title will now shine upon /leaderboard and /status.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
