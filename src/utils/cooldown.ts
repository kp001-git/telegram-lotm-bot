import { BeyonderRole } from "../database/repositories/user.repository";
import { isShadowSovereign } from "../config";

interface CooldownEntry {
  expiresAt: number;
}

class CooldownManager {
  private store = new Map<string, CooldownEntry>();

  /**
   * Checks if an action is within cooldown.
   * If CELESTIAL_WORTHY or Shadow Sovereign, cooldown is bypassed automatically.
   */
  checkCooldown(
    key: string,
    cooldownSeconds: number,
    role?: BeyonderRole,
    userId?: number
  ): { allowed: boolean; remainingSeconds: number } {
    if (role === "CELESTIAL_WORTHY" || isShadowSovereign(userId)) {
      return { allowed: true, remainingSeconds: 0 };
    }

    // Also inspect trailing userId in key (e.g. "fate:123456")
    const parts = key.split(":");
    const tailId = Number(parts[parts.length - 1]);
    if (!Number.isNaN(tailId) && isShadowSovereign(tailId)) {
      return { allowed: true, remainingSeconds: 0 };
    }

    const now = Date.now();
    const entry = this.store.get(key);

    if (entry && now < entry.expiresAt) {
      const remainingSeconds = Math.ceil((entry.expiresAt - now) / 1000);
      return { allowed: false, remainingSeconds };
    }

    // Set new cooldown
    this.store.set(key, {
      expiresAt: now + cooldownSeconds * 1000,
    });

    return { allowed: true, remainingSeconds: 0 };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const cooldownManager = new CooldownManager();
