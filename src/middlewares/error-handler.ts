import { BotError } from "grammy";
import { MyContext } from "./context";

export async function errorHandler(err: BotError<MyContext>): Promise<void> {
  const ctx = err.ctx;
  console.error(`[GreyFog Error] Error handling update ${ctx.update.update_id}:`, err.error);

  try {
    if (ctx.chat) {
      await ctx.reply(
        "𓆩 <i>A tremor ripples through the spirit world. The divine order remains intact, but the incantation failed.</i> 𓆪",
        { parse_mode: "HTML" }
      );
    }
  } catch (replyErr) {
    console.error("[GreyFog Error] Failed to send error notification:", replyErr);
  }
}
