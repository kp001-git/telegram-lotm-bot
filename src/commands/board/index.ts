import { Bot } from "grammy";
import { MyContext } from "../../middlewares/context";
import { groupOnlyGuard } from "../../middlewares/guard";
import { requireRole } from "../../middlewares/rbac";
import { divinationCommand } from "./divination";
import { sacredLawsCommand } from "./sacred_laws";
import { mysteriesCommand } from "./mysteries";
import { fateRecordsCommand } from "./fate_records";
import { summoningCommand, renderWelcomeTemplate } from "./summoning";
import { farewellCommand, renderFarewellTemplate } from "./farewell";
import { loreCommand } from "./lore";
import { groupRepository } from "../../database/repositories/group.repository";
import { userRepository } from "../../database/repositories/user.repository";

export * from "./divination";
export * from "./sacred_laws";
export * from "./mysteries";
export * from "./fate_records";
export * from "./summoning";
export * from "./farewell";
export * from "./lore";

export function registerBoardCommands(bot: Bot<MyContext>): void {
  // 1. Directory & Navigation
  bot.command(["divination", "start", "help"], divinationCommand);

  // 2. Information Board & Decrees
  bot.command("sacred_laws", sacredLawsCommand);
  bot.command("lore", loreCommand);

  // 3. Group Specific Insights & Ledger
  bot.command("mysteries", groupOnlyGuard, mysteriesCommand);
  bot.command("fate_records", groupOnlyGuard, fateRecordsCommand);
  bot.command("summoning", groupOnlyGuard, summoningCommand);
  bot.command(
    "farewell",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    farewellCommand
  );

  // 4. Automatic New Member Summoning Listener
  bot.on("message:new_chat_members", async (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    const chat = ctx.chat;
    if (!newMembers || newMembers.length === 0 || !chat) return;

    const isSealed = await groupRepository.isChatSealed(chat.id);
    const welcomeConfig = await groupRepository.getWelcomeConfig(chat.id);
    let memberCount = 1;
    try {
      memberCount = await ctx.getChatMemberCount();
    } catch {
      memberCount = 1;
    }

    const groupTitle = chat.title || "The Tarot Club";

    for (const member of newMembers) {
      if (member.is_bot) continue;

      // Upsert new Beyonder into Turso
      try {
        await userRepository.upsertMember(
          chat.id,
          member.id,
          member.username || null,
          member.first_name,
          "BEYONDER"
        );
      } catch (err) {
        console.error(`[new_chat_members] Failed to upsert ${member.id}:`, err);
      }

      if (!welcomeConfig.enabled) continue;

      // Render & send welcome summoning rite
      const welcomeText = renderWelcomeTemplate(
        welcomeConfig.template,
        { id: member.id, firstName: member.first_name, username: member.username },
        groupTitle,
        memberCount,
        isSealed
      );

      try {
        await ctx.reply(welcomeText, { parse_mode: "HTML" });
      } catch (err: any) {
        console.error(`[new_chat_members] Failed to send welcome greeting:`, err?.message);
      }
    }
  });

  // 5. Automatic Member Departure Listener
  bot.on("message:left_chat_member", async (ctx) => {
    const leftMember = ctx.message.left_chat_member;
    const chat = ctx.chat;
    if (!leftMember || leftMember.is_bot || !chat) return;

    const goodbyeConfig = await groupRepository.getGoodbyeConfig(chat.id);
    if (!goodbyeConfig.enabled) return;

    let memberCount = 1;
    try {
      memberCount = await ctx.getChatMemberCount();
    } catch {
      memberCount = 1;
    }

    const groupTitle = chat.title || "The Tarot Club";
    const farewellText = renderFarewellTemplate(
      goodbyeConfig.template,
      { id: leftMember.id, firstName: leftMember.first_name, username: leftMember.username },
      groupTitle,
      memberCount
    );

    try {
      await ctx.reply(farewellText, { parse_mode: "HTML" });
    } catch (err: any) {
      console.error(`[left_chat_member] Failed to send farewell greeting:`, err?.message);
    }
  });
}
