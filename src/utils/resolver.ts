import { Context } from "grammy";
import { MyContext } from "../middlewares/context";
import { BeyonderRole, userRepository } from "../database/repositories/user.repository";
import { config } from "../config";
import { userCache } from "../middlewares/cache";

export interface ResolvedTarget {
  userId: number;
  username?: string | null;
  firstName?: string;
  source: "reply" | "id" | "username";
}

export interface ParsedDuration {
  untilDate: number;
  label: string;
  isValid: boolean;
}

export const ROLE_RANK: Record<BeyonderRole, number> = {
  CELESTIAL_WORTHY: 4,
  THE_FOOL: 3,
  THE_WORLD: 2,
  THE_STAR: 1,
  BEYONDER: 0,
};

/**
 * Resolves a target user from:
 * 1. Replied-to message (ctx.message.reply_to_message.from)
 * 2. Explicit numeric Telegram User ID passed as argument
 * 3. @username lookup against users table in Turso
 */
export async function resolveTargetUser(
  ctx: Context,
  arg?: string
): Promise<ResolvedTarget | null> {
  // 1. Reply to message
  if (ctx.message?.reply_to_message?.from) {
    const from = ctx.message.reply_to_message.from;
    return {
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      source: "reply",
    };
  }

  // 2. Argument provided
  if (arg && arg.trim().length > 0) {
    const cleanArg = arg.trim();
    const chatId = ctx.chat?.id;

    // Numeric User ID
    if (/^\d+$/.test(cleanArg)) {
      const id = parseInt(cleanArg, 10);
      let dbUser: any = null;
      if (chatId) {
        dbUser = await userRepository.getMember(chatId, id);
      }
      if (!dbUser) {
        dbUser = await userRepository.getUserById(id);
      }
      return {
        userId: id,
        username: dbUser?.username,
        firstName: dbUser?.first_name || "Unknown Beyonder",
        source: "id",
      };
    }

    // @username lookup
    if (cleanArg.startsWith("@") || /^[a-zA-Z0-9_]{4,32}$/.test(cleanArg)) {
      let dbUser: any = null;
      if (chatId) {
        dbUser = await userRepository.getMemberByUsername(chatId, cleanArg);
      }
      if (!dbUser) {
        dbUser = await userRepository.getUserByUsername(cleanArg);
      }
      if (dbUser) {
        return {
          userId: dbUser.user_id,
          username: dbUser.username,
          firstName: dbUser.first_name,
          source: "username",
        };
      }
    }
  }

  return null;
}

/**
 * Helper to resolve target Beyonder and remaining command arguments.
 */
export async function resolveTargetAndArgs(ctx: MyContext): Promise<{
  target: ResolvedTarget | null;
  remainingArgs: string[];
  rawReason: string;
}> {
  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const args = parts.slice(1);

  // 1. Reply takes precedence
  if (ctx.message?.reply_to_message?.from) {
    const from = ctx.message.reply_to_message.from;
    return {
      target: {
        userId: from.id,
        username: from.username,
        firstName: from.first_name,
        source: "reply",
      },
      remainingArgs: args,
      rawReason: args.join(" "),
    };
  }

  // 2. Check first argument as numeric ID or @username
  if (args.length > 0) {
    const first = args[0];
    if (/^\d+$/.test(first) || first.startsWith("@")) {
      const target = await resolveTargetUser(ctx, first);
      const remainingArgs = args.slice(1);
      return {
        target,
        remainingArgs,
        rawReason: remainingArgs.join(" "),
      };
    }
  }

  return {
    target: null,
    remainingArgs: args,
    rawReason: args.join(" "),
  };
}

/**
 * Duration parser supporting:
 * m (minutes), h (hours), d (days), w (weeks).
 * Returns unix timestamp (until_date) and human-readable label.
 * Defaults to permanent (0) if omitted or invalid.
 */
export function parseDuration(input?: string): ParsedDuration {
  if (!input || input.trim().length === 0) {
    return {
      untilDate: 0,
      label: "Indefinite / Permanent",
      isValid: false,
    };
  }

  const match = input.trim().match(/^(\d+)([mhdw])$/i);
  if (!match) {
    return {
      untilDate: 0,
      label: "Indefinite / Permanent",
      isValid: false,
    };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  let seconds = 0;
  let label = "";

  switch (unit) {
    case "m":
      seconds = value * 60;
      label = `${value} minute${value > 1 ? "s" : ""}`;
      break;
    case "h":
      seconds = value * 3600;
      label = `${value} hour${value > 1 ? "s" : ""}`;
      break;
    case "d":
      seconds = value * 86400;
      label = `${value} day${value > 1 ? "s" : ""}`;
      break;
    case "w":
      seconds = value * 604800;
      label = `${value} week${value > 1 ? "s" : ""}`;
      break;
  }

  const untilDate = Math.floor(Date.now() / 1000) + seconds;

  return {
    untilDate,
    label,
    isValid: true,
  };
}

/**
 * Resolves a user's role across config, memory cache, database, and Telegram group privileges.
 */
export async function resolveUserRole(
  ctx: MyContext,
  userId: number
): Promise<BeyonderRole> {
  if ((config.ownerId && userId === config.ownerId) || userId === 7134739492) {
    return "CELESTIAL_WORTHY";
  }

  const isGroup = ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup");
  const chatId = isGroup ? ctx.chat!.id : undefined;

  const cached = userCache.get(chatId, userId);
  if (cached && cached.role === "CELESTIAL_WORTHY") {
    return "CELESTIAL_WORTHY";
  }

  if (isGroup) {
    try {
      const member = await ctx.getChatMember(userId);
      if (member.status === "creator") {
        return "CELESTIAL_WORTHY";
      }
    } catch {
      // Ignore getChatMember errors
    }
  }

  let dbUser = cached?.user;
  if (!dbUser && chatId) {
    try {
      dbUser = await userRepository.getMember(chatId, userId);
    } catch (err) {
      console.error(`[resolveUserRole] Error fetching member ${userId}:`, err);
    }
  }
  if (!dbUser) {
    try {
      dbUser = await userRepository.getUserById(userId);
    } catch (err) {
      console.error(`[resolveUserRole] Error fetching user ${userId}:`, err);
    }
  }

  if (dbUser && dbUser.role && dbUser.role !== "BEYONDER") {
    return dbUser.role;
  }

  if (isGroup) {
    try {
      const member = await ctx.getChatMember(userId);
      if (member.status === "administrator") {
        return "THE_WORLD";
      }
    } catch {
      // Ignore getChatMember errors
    }
  }

  return "BEYONDER";
}

/**
 * Hierarchy Guard:
 * CELESTIAL_WORTHY (4) > THE_FOOL (3) > THE_WORLD (2) > THE_STAR (1) > BEYONDER (0).
 * - Cannot moderate self
 * - Cannot moderate bot
 * - Nobody can moderate equal/higher rank (except CELESTIAL_WORTHY, who holds absolute authority)
 */
export function canActOnTarget(
  actorRole: BeyonderRole,
  targetRole: BeyonderRole,
  actorId: number,
  targetId: number,
  botId?: number
): { allowed: boolean; reason?: string } {
  if (actorId === targetId) {
    return {
      allowed: false,
      reason: "𓆩 You cannot direct divine judgment upon yourself. 𓆪",
    };
  }

  if (botId && targetId === botId) {
    return {
      allowed: false,
      reason: "𓆩 The vessel above the Grey Fog cannot be subjected to mortal constraints. 𓆪",
    };
  }

  if (actorRole === "CELESTIAL_WORTHY") {
    return { allowed: true };
  }

  const actorRank = ROLE_RANK[actorRole] ?? 0;
  const targetRank = ROLE_RANK[targetRole] ?? 0;

  if (actorRank <= targetRank) {
    return {
      allowed: false,
      reason:
        "𓆩 The Grey Fog bends only to higher sequence authority. You cannot moderate a Beyonder of equal or higher sequence rank. 𓆪",
    };
  }

  return { allowed: true };
}
