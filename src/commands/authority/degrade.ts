import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { userCache } from "../../middlewares/cache";
import { resolveTargetAndArgs, canActOnTarget, resolveUserRole } from "../../utils/resolver";
import { formatHeader, formatDivider, formatUserMention } from "../../utils/formatters";

export async function degradeCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target } = await resolveTargetAndArgs(ctx);

  if (!target) {
    await ctx.reply(
      "𓆩 Specify a Beyonder via reply, User ID, or @username to strip divine authority. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const currentTargetRole = await resolveUserRole(ctx, target.userId);
  const botInfo = ctx.me;
  const check = canActOnTarget(ctx.memberRole, currentTargetRole, from.id, target.userId, botInfo.id);

  if (!check.allowed) {
    await ctx.reply(check.reason || "𓆩 The hierarchy of the council forbids this act. 𓆪", {
      parse_mode: "HTML",
    });
    return;
  }

  // 1. Demote to BEYONDER in Turso
  await userRepository.setMemberRole(chat.id, target.userId, "BEYONDER");
  userCache.invalidate(chat.id, target.userId);

  // 2. Revoke Telegram admin privileges
  try {
    await ctx.api.promoteChatMember(chat.id, target.userId, {
      can_manage_chat: false,
      can_delete_messages: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_invite_users: false,
      can_manage_video_chats: false,
      can_promote_members: false,
      can_change_info: false,
    });
  } catch (err: any) {
    console.warn(`[degrade] Telegram promoteChatMember revoke for ${target.userId}:`, err?.description || err?.message);
  }

  // 3. Log audit
  await auditRepository.logAndMirror(ctx.api, {
    chat_id: chat.id,
    actor_id: from.id,
    target_id: target.userId,
    action: "DEGRADE",
    reason: `Council authority revoked; demoted to BEYONDER`,
  });

  const response = [
    formatHeader("Sequence Degradation"),
    `${formatUserMention(target.userId, target.firstName || "Beyonder", target.username)} has been stripped of council seat and cast down to standard Beyonder sequence.`,
    `\n<b>Executor:</b> ${formatUserMention(from.id, from.first_name, from.username)}`,
    formatDivider(),
    `<i>The mystical ledger has recorded the revocation.</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
