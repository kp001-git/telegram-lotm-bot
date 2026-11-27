import { MyContext } from "../../middlewares/context";
import { userRepository, BeyonderRole } from "../../database/repositories/user.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { userCache } from "../../middlewares/cache";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { isShadowSovereign } from "../../config";
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

  // Only CELESTIAL_WORTHY (or Shadow Sovereign) can assign THE_FOOL
  if (targetRole === "THE_FOOL" && ctx.memberRole !== "CELESTIAL_WORTHY" && !isShadowSovereign(from.id)) {
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
  await userRepository.setMemberRole(chat.id, target.userId, targetRole);
  userCache.invalidate(chat.id, target.userId);

  // 2. Grant Telegram admin rights with valid Telegram Bot API boolean flags
  let telegramAdminGranted = false;
  let telegramAdminError: string | null = null;
  try {
    await ctx.api.promoteChatMember(chat.id, target.userId, {
      can_manage_chat: true,
      can_delete_messages: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_invite_users: true,
      can_manage_video_chats: true,
      can_promote_members: false,
      can_change_info: false,
    });
    telegramAdminGranted = true;
  } catch (err: any) {
    telegramAdminError = err?.description || err?.message || "Missing privileges";
    console.warn(`[ascend] Note: Telegram promoteChatMember for ${target.userId}:`, telegramAdminError);
  }

  // 3. Set Custom Admin Title if promoted
  if (telegramAdminGranted) {
    const roleTitleMap: Record<BeyonderRole, string> = {
      CELESTIAL_WORTHY: "Celestial Worthy",
      THE_FOOL: "The Fool",
      THE_WORLD: "The World",
      THE_STAR: "The Star",
      BEYONDER: "Beyonder",
    };
    const roleTitle = roleTitleMap[targetRole] || "Council Member";
    try {
      await ctx.api.setChatAdministratorCustomTitle(chat.id, target.userId, roleTitle);
    } catch (err: any) {
      console.warn(`[ascend] setChatAdministratorCustomTitle for ${target.userId}:`, err?.description || err?.message);
    }
  }

  // 4. Log audit
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "ASCEND",
    reason: `Elevated to council seat: ${targetRole}`,
  });

  const adminNotice = !telegramAdminGranted
    ? `\n⚠️ <i>Notice: Council seat recorded in the mystical ledger, but native Telegram admin privileges could not be applied (${escapeHtml(telegramAdminError || "missing bot 'Add New Admins' permission")}).</i>`
    : "";

  const response = [
    formatHeader("Divine Elevation"),
    `${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has consumed the potion of authority and ascends to the council seat of ${formatRoleBadge(targetRole)}.`,
    `\n<b>Executor:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    adminNotice,
    formatDivider(),
    `<i>The Tarot Club recognizes your sacred responsibilities.</i>`,
  ].filter(Boolean).join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
