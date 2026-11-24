import { BeyonderRole, DbUser } from "../database/repositories/user.repository";

interface CacheEntry {
  user: DbUser | null;
  role: BeyonderRole;
  lastSeenName: string;
  lastSeenUsername: string | null;
  unsavedMessages: number;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

class UserCache {
  private cache = new Map<string, CacheEntry>();

  private makeKey(chatId: number | undefined | null, userId: number): string {
    return `${chatId ?? "global"}:${userId}`;
  }

  get(chatIdOrUserId: number | undefined | null, maybeUserId?: number): CacheEntry | undefined {
    let key: string;
    if (maybeUserId !== undefined) {
      key = this.makeKey(chatIdOrUserId, maybeUserId);
    } else {
      key = this.makeKey(undefined, chatIdOrUserId as number);
    }

    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry;
  }

  set(
    chatIdOrUserId: number | undefined | null,
    userIdOrRole: number | BeyonderRole,
    roleOrUser?: BeyonderRole | DbUser | null,
    userOrFirstName?: DbUser | null | string,
    firstNameOrUsername?: string | string | null,
    maybeUsername?: string | null
  ): void {
    let key: string;
    let role: BeyonderRole;
    let user: DbUser | null;
    let firstName: string;
    let username: string | null;

    if (typeof userIdOrRole === "number") {
      // Called with (chatId, userId, role, user, firstName, username)
      key = this.makeKey(chatIdOrUserId, userIdOrRole);
      role = roleOrUser as BeyonderRole;
      user = (userOrFirstName as DbUser | null) || null;
      firstName = (firstNameOrUsername as string) || "";
      username = maybeUsername ?? null;
    } else {
      // Legacy signature: (userId, role, user, firstName, username)
      key = this.makeKey(undefined, chatIdOrUserId as number);
      role = userIdOrRole as BeyonderRole;
      user = (roleOrUser as DbUser | null) || null;
      firstName = (userOrFirstName as string) || "";
      username = (firstNameOrUsername as string) ?? null;
    }

    const existing = this.cache.get(key);
    this.cache.set(key, {
      user,
      role,
      lastSeenName: firstName,
      lastSeenUsername: username,
      unsavedMessages: existing ? existing.unsavedMessages : 0,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  incrementMessages(chatIdOrUserId: number | undefined | null, maybeUserId?: number): number {
    const entry = this.get(chatIdOrUserId, maybeUserId);
    if (entry) {
      entry.unsavedMessages += 1;
      return entry.unsavedMessages;
    }
    return 1;
  }

  resetUnsavedMessages(chatIdOrUserId: number | undefined | null, maybeUserId?: number): void {
    const entry = this.get(chatIdOrUserId, maybeUserId);
    if (entry) {
      entry.unsavedMessages = 0;
    }
  }

  invalidate(chatIdOrUserId: number | undefined | null, maybeUserId?: number): void {
    if (maybeUserId !== undefined) {
      this.cache.delete(this.makeKey(chatIdOrUserId, maybeUserId));
      // Also delete global fallback key
      this.cache.delete(this.makeKey(undefined, maybeUserId));
    } else if (chatIdOrUserId !== undefined && chatIdOrUserId !== null) {
      // Invalidate both direct key and any scoped keys for this userId
      this.cache.delete(this.makeKey(undefined, chatIdOrUserId));
      for (const key of this.cache.keys()) {
        if (key.endsWith(`:${chatIdOrUserId}`)) {
          this.cache.delete(key);
        }
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const userCache = new UserCache();
