import { NextFunction } from "grammy";
import { MyContext } from "./context";

export async function groupOnlyGuard(ctx: MyContext, next: NextFunction): Promise<void> {
  const chatType = ctx.chat?.type;
  if (!chatType || (chatType !== "group" && chatType !== "supergroup")) {
    await ctx.reply(
      "𓆩 This sacred rite may only be conducted within the sanctuary of the Tarot Club group. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }
  await next();
}
