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
  private cache = new Map<number, CacheEntry>();

  get(userId: number): CacheEntry | undefined {
    const entry = this.cache.get(userId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return undefined;
    }
    return entry;
  }

  set(userId: number, role: BeyonderRole, user: DbUser | null, firstName: string, username: string | null): void {
    const existing = this.cache.get(userId);
    this.cache.set(userId, {
      user,
      role,
      lastSeenName: firstName,
      lastSeenUsername: username,
      unsavedMessages: existing ? existing.unsavedMessages : 0,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  incrementMessages(userId: number): number {
    const entry = this.get(userId);
    if (entry) {
      entry.unsavedMessages += 1;
      return entry.unsavedMessages;
    }
    return 1;
  }

  resetUnsavedMessages(userId: number): void {
    const entry = this.get(userId);
    if (entry) {
      entry.unsavedMessages = 0;
    }
  }

  invalidate(userId: number): void {
    this.cache.delete(userId);
  }
}

export const userCache = new UserCache();
