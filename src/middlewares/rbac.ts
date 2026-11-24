import { NextFunction } from "grammy";
import { MyContext } from "./context";
import { BeyonderRole, userRepository } from "../database/repositories/user.repository";
import { config } from "../config";
import { userCache } from "./cache";

/**
 * RBAC Middleware: Attach ctx.memberRole to context.
 * Resolve role by checking:
 * 1. Hardcoded OWNER_ID or Telegram `creator` -> CELESTIAL_WORTHY
 * 2. Stored Turso DB role (THE_FOOL, THE_WORLD, THE_STAR)
 * 3. Any other native Telegram `administrator` -> defaults to THE_WORLD unless assigned otherwise
 * 4. Regular member -> BEYONDER
 */
export async function rbacMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from) {
    ctx.memberRole = "BEYONDER";
    return next();
  }

  const userId = from.id;

  // 1. Check if user is configured OWNER_ID or Celestial Worthy ID
  if ((config.ownerId && userId === config.ownerId) || userId === 7134739492) {
    ctx.memberRole = "CELESTIAL_WORTHY";
    return next();
  }

  const isGroup = ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup");
  const chatId = isGroup ? ctx.chat!.id : undefined;

  // Check cache for role
  const cached = userCache.get(chatId, userId);
  if (cached && cached.role === "CELESTIAL_WORTHY") {
    ctx.memberRole = "CELESTIAL_WORTHY";
    return next();
  }

  // Check group membership role if in group/supergroup
  let isTelegramCreator = false;
  let isTelegramAdmin = false;

  if (isGroup) {
    try {
      const member = await ctx.getChatMember(userId);
      if (member.status === "creator") {
        isTelegramCreator = true;
      } else if (member.status === "administrator") {
        isTelegramAdmin = true;
      }
    } catch {
      // Ignore getChatMember errors (e.g. channel or missing perms)
    }
  }

  // If creator, highest authority
  if (isTelegramCreator) {
    ctx.memberRole = "CELESTIAL_WORTHY";
    return next();
  }

  // 2. Check stored Turso DB role (prefer group_members for this chat)
  let dbUser = ctx.dbUser;
  if (!dbUser && !cached) {
    try {
      if (chatId) {
        dbUser = await userRepository.getMember(chatId, userId);
      }
      if (!dbUser) {
        dbUser = await userRepository.getUserById(userId);
      }
    } catch (err) {
      console.error(`[rbac] Error fetching user ${userId}:`, err);
    }
  }

  const dbRole = dbUser?.role || cached?.role;
  if (dbRole && dbRole !== "BEYONDER") {
    ctx.memberRole = dbRole;
    return next();
  }

  // 3. Telegram administrator defaults to THE_WORLD
  if (isTelegramAdmin) {
    ctx.memberRole = "THE_WORLD";
    return next();
  }

  // 4. Default Beyonder
  ctx.memberRole = "BEYONDER";
  await next();
}

/**
 * Permission helper that guards commands by allowed roles.
 * Denies unauthorized users with the atmospheric LOTM rejection message.
 */
export function requireRole(...allowedRoles: BeyonderRole[]) {
  return async (ctx: MyContext, next: NextFunction): Promise<void> => {
    const role = ctx.memberRole || "BEYONDER";

    if (allowedRoles.includes(role)) {
      return next();
    }

    const rejectionMessage =
      "𓆩 The Grey Fog blocks your path. Only High-Sequence Beyonders of the Council may invoke this authority. 𓆪";

    await ctx.reply(rejectionMessage, { parse_mode: "HTML" });
  };
}
