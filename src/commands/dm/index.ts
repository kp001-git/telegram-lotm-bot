import { Bot } from "grammy";
import { MyContext } from "../../middlewares/context";
import { startCommand } from "./start";
import { connectCommand, disconnectCommand, sanctuariesCommand } from "./connect";
import { manageCommand } from "./panel";
import { cancelCommand, dmInputListenerMiddleware } from "./input-listener";
import { registerDmCallbacks } from "./callbacks";

export * from "./start";
export * from "./connect";
export * from "./panel";
export * from "./input-listener";
export * from "./callbacks";

export function registerDmCommands(bot: Bot<MyContext>): void {
  bot.command("start", startCommand);
  bot.command("connect", connectCommand);
  bot.command("disconnect", disconnectCommand);
  bot.command(["sanctuaries", "groups"], sanctuariesCommand);
  bot.command(["manage", "panel"], manageCommand);
  bot.command("cancel", cancelCommand);

  registerDmCallbacks(bot);
  bot.use(dmInputListenerMiddleware);
}
