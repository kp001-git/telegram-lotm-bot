import { NextFunction } from "grammy";
import { MyContext } from "./context";
import { userCache } from "./cache";
import { userRepository } from "../database/repositories/user.repository";

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

  const userId = from.id;
  const username = from.username || null;
  const firstName = from.first_name;

  const cached = userCache.get(userId);

  if (!cached) {
    // Cache miss: sync to Turso once and cache
    try {
      await userRepository.upsertUser(userId, username, firstName, "BEYONDER");
      const dbUser = await userRepository.getUserById(userId);
      const role = dbUser?.role || "BEYONDER";
      userCache.set(userId, role, dbUser, firstName, username);
      ctx.dbUser = dbUser;
    } catch (err) {
      console.error(`[userSync] Error syncing user ${userId}:`, err);
    }
  } else {
    // Cache hit: check for profile changes
    const profileChanged =
      cached.lastSeenName !== firstName || cached.lastSeenUsername !== username;

    const count = userCache.incrementMessages(userId);

    if (profileChanged || count >= 10) {
      userCache.resetUnsavedMessages(userId);
      userRepository
        .upsertUser(userId, username, firstName, cached.role, count)
        .then(async () => {
          const dbUser = await userRepository.getUserById(userId);
          userCache.set(userId, cached.role, dbUser, firstName, username);
        })
        .catch((err) => {
          console.error(`[userSync] Background flush failed for ${userId}:`, err);
        });
    }

    ctx.dbUser = cached.user;
  }

  await next();
}
