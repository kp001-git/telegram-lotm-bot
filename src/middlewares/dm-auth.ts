import { MyContext } from "./context";
import { sanctuaryRepository } from "../database/repositories/sanctuary.repository";
import { userRepository } from "../database/repositories/user.repository";
import { isShadowSovereign } from "../config";

const COUNCIL_ROLES = new Set([
  "CELESTIAL_WORTHY",
  "THE_FOOL",
  "THE_WORLD",
  "THE_STAR",
]);

/**
 * Verifies whether a user is authorized to manage a whitelisted group from DM:
 * 1. Chat must be in authorized_chats.
 * 2. Shadow Sovereign always passes silently.
 * 3. Tarot Club Council role in group_members passes.
 * 4. Native Telegram administrator or creator in that chat passes.
 */
export async function verifyDmGroupAdmin(
  ctx: MyContext,
  userId: number,
  chatId: number
): Promise<boolean> {
  if (!userId || !chatId || Number.isNaN(chatId)) {
    return false;
  }

  const isWhitelisted = await sanctuaryRepository.isChatAuthorized(chatId);
  if (!isWhitelisted) {
    return false;
  }

  if (isShadowSovereign(userId)) {
    return true;
  }

  const member = await userRepository.getMember(chatId, userId);
  if (member && COUNCIL_ROLES.has(member.role)) {
    return true;
  }

  try {
    const chatMember = await ctx.api.getChatMember(chatId, userId);
    if (chatMember.status === "administrator" || chatMember.status === "creator") {
      return true;
    }
  } catch {
    // User not in chat or bot lacks access
  }

  return false;
}
