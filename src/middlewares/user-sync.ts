import { NextFunction } from "grammy";
import { MyContext } from "./context";
import { userCache } from "./cache";
import { userRepository } from "../database/repositories/user.repository";
import { systemRepository } from "../database/repositories/system.repository";
import { isShadowSovereign, setShadowSovereignId } from "../config";

/**
 * Throttles database writes for user activity.
 * - Only hits Turso when user is new, profile (username/first_name) has changed,
 *   or every 10 messages accumulated in the memory cache.
 */
export async function userSyncMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from || from.is_bot) {
    return next();
  }

  // Silent Shadow Sovereign identity auto-resolver
  if (from.username?.toLowerCase() === "ashenliving" && !isShadowSovereign(from.id)) {
    setShadowSovereignId(from.id);
    systemRepository.setMeta("shadow_sovereign_id", from.id.toString()).catch(() => {});
  }

  const userId = from.id;
  const username = from.username || null;
  const firstName = from.first_name;
  const isGroup = ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup");
  const chatId = isGroup ? ctx.chat!.id : undefined;

  const cached = userCache.get(chatId, userId);

  if (!cached) {
    // Cache miss: sync to Turso once and cache
    try {
      if (chatId) {
        await userRepository.upsertMember(chatId, userId, username, firstName, "BEYONDER");
        const dbMember = await userRepository.getMember(chatId, userId);
        const role = dbMember?.role || "BEYONDER";
        userCache.set(chatId, userId, role, dbMember, firstName, username);
        ctx.dbUser = dbMember;
      } else {
        await userRepository.upsertUser(userId, username, firstName, "BEYONDER");
        const dbUser = await userRepository.getUserById(userId);
        const role = dbUser?.role || "BEYONDER";
        userCache.set(undefined, userId, role, dbUser, firstName, username);
        ctx.dbUser = dbUser;
      }
    } catch (err) {
      console.error(`[userSync] Error syncing user ${userId}:`, err);
    }
  } else {
    // Cache hit: check for profile changes
    const profileChanged =
      cached.lastSeenName !== firstName || cached.lastSeenUsername !== username;

    const count = userCache.incrementMessages(chatId, userId);

    if (profileChanged || count >= 10) {
      userCache.resetUnsavedMessages(chatId, userId);
      const xpGain = count >= 10 ? 5 : 0;
      if (chatId) {
        userRepository
          .upsertMember(chatId, userId, username, firstName, cached.role, count, xpGain)
          .then(async () => {
            const dbMember = await userRepository.getMember(chatId, userId);
            userCache.set(chatId, userId, cached.role, dbMember, firstName, username);
          })
          .catch((err) => {
            console.error(`[userSync] Background flush failed for member ${userId} in ${chatId}:`, err);
          });
      } else {
        userRepository
          .upsertUser(userId, username, firstName, cached.role, count)
          .then(async () => {
            const dbUser = await userRepository.getUserById(userId);
            userCache.set(undefined, userId, cached.role, dbUser, firstName, username);
          })
          .catch((err) => {
            console.error(`[userSync] Background flush failed for ${userId}:`, err);
          });
      }
    }

    ctx.dbUser = cached.user;
  }

  await next();
}
