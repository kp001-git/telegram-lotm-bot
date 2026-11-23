import { Bot } from "grammy";
import { MyContext } from "../../middlewares/context";
import { groupOnlyGuard } from "../../middlewares/guard";
import { suggestCommand } from "./suggest";
import { ideaCommand } from "./idea";
import { reportCommand } from "./report";
import { voteCommand } from "./vote";
import { suggestionsCommand } from "./suggestions";
import { registerGovernanceCallbacks } from "./callbacks";

export * from "./suggest";
export * from "./idea";
export * from "./report";
export * from "./vote";
export * from "./suggestions";
export * from "./helpers";
export * from "./callbacks";

export function registerGovernanceCommands(bot: Bot<MyContext>): void {
  // Member Submissions & Feedback
  bot.command("suggest", suggestCommand);
  bot.command("idea", ideaCommand);
  bot.command("report", reportCommand);

  // Voting & Community Polls
  bot.command("vote", groupOnlyGuard, voteCommand);

  // Approved Ledger
  bot.command("suggestions", suggestionsCommand);

  // Interactive Callbacks (Review Card triage & Live Poll voting)
  registerGovernanceCallbacks(bot);
}
