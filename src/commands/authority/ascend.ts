import { MyContext } from "../../middlewares/context";
import { userRepository, BeyonderRole } from "../../database/repositories/user.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { userCache } from "../../middlewares/cache";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention, formatRoleBadge, escapeHtml } from "../../utils/formatters";

export async function ascendCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target, remainingArgs } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username to confer divine elevation. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  // Determine target council role
  const roleInput = remainingArgs[0]?.toLowerCase() || "world";
  let targetRole: BeyonderRole;

  switch (roleInput) {
    case "fool":
    case "the_fool":
      targetRole = "THE_FOOL";
      break;
    case "world":
    case "the_world":
      targetRole = "THE_WORLD";
      break;
    case "star":
    case "the_star":
      targetRole = "THE_STAR";
      break;
    default:
      await ctx.reply(
        "𓆩 Invalid council seat. Permissible seats: <code>fool</code>, <code>world</code>, <code>star</code>. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
  }

  // Only CELESTIAL_WORTHY can assign THE_FOOL
  if (targetRole === "THE_FOOL" && ctx.memberRole !== "CELESTIAL_WORTHY") {
    await ctx.reply(
      "𓆩 Only the Celestial Worthy holds primordial authority to appoint the seat of The Fool. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  // Hierarchy check
  const currentTargetRole = await resolveUserRole(ctx, target.userId);
  const botInfo = ctx.me;
  const check = canActOnTarget(ctx.memberRole, currentTargetRole, from.id, target.userId, botInfo.id);

  if (!check.allowed) {
    await ctx.reply(check.reason || "𓆩 The hierarchy of the council forbids this act. 𓆪", {
      parse_mode: "HTML",
    });
    return;
  }

  // 1. Update Turso
  await userRepository.setRole(target.userId, targetRole);
  userCache.invalidate(target.userId);

  // 2. Grant Telegram admin rights
  try {
    await ctx.promoteChatMember(target.userId, {
      can_manage_chat: true,
      can_delete_messages: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_invite_users: true,
      is_anonymous: false,
    });
  } catch (err: any) {
    console.warn(`[ascend] Note: Telegram promoteChatMember for ${target.userId}:`, err?.message);
  }

  // 3. Log audit
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "ASCEND",
    reason: `Elevated to council seat: ${targetRole}`,
  });

  const response = [
    formatHeader("Divine Elevation"),
    `${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has consumed the potion of authority and ascends to the council seat of ${formatRoleBadge(targetRole)}.`,
    `\n<b>Executor:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>The Tarot Club recognizes your sacred responsibilities.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
