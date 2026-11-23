import { NextFunction } from "grammy";
import { MyContext } from "./context";
import { sanctuaryRepository } from "../database/repositories/sanctuary.repository";

export const UNAUTHORIZED_GROUP_MESSAGE =
  `This group is not whitelisted to use @greyfogbot.\n\nIf you want to add this bot to your group, please contact <a href="https://t.me/ashenliving">Soul</a> for permission.`;

export async function groupOnlyGuard(ctx: MyContext, next: NextFunction): Promise<void> {
  const chat = ctx.chat;
  if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) {
    await ctx.reply(
      "𓆩 This sacred rite may only be conducted within the sanctuary of the Tarot Club group. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  // Verify group whitelist authorization
  const isAuthorized = await sanctuaryRepository.isChatAuthorized(chat.id);
  if (!isAuthorized) {
    try {
      await ctx.reply(UNAUTHORIZED_GROUP_MESSAGE, { parse_mode: "HTML" });
    } catch (err) {
      console.warn(`[gatekeeper] Failed to send exit message to ${chat.id}:`, err);
    }
    try {
      await ctx.leaveChat();
    } catch (err) {
      console.warn(`[gatekeeper] Failed to leave chat ${chat.id}:`, err);
    }
    return; // Stop middleware execution
  }

  await next();
}
