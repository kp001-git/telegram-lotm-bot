import https from "node:https";
import { Bot } from "grammy";
import { hydrate } from "@grammyjs/hydrate";
import { config } from "./config";
import { MyContext } from "./middlewares/context";
import { userSyncMiddleware } from "./middlewares/user-sync";
import { rbacMiddleware } from "./middlewares/rbac";
import { errorHandler } from "./middlewares/error-handler";
import { registerAuthorityCommands } from "./commands/authority";
import { registerBoardCommands } from "./commands/board";
import { registerGovernanceCommands } from "./commands/governance";
import { registerMysticalCommands } from "./commands/mystical";
import { sanctuaryRepository } from "./database/repositories/sanctuary.repository";
import { UNAUTHORIZED_GROUP_MESSAGE } from "./middlewares/guard";

export function createBot(): Bot<MyContext> {
  // Guarantee IPv4 sockets for all Telegram API calls on Render/Cloud environments
  const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

  const bot = new Bot<MyContext>(config.botToken, {
    client: {
      canUseWebhookReply: () => false,
      baseFetchConfig: {
        agent: httpsAgent,
      } as any,
    },
  });

  // 1. Hydrate plugin for convenient message methods
  bot.use(hydrate());

  // 2. Whitelist Gatekeeper: Group auto-exit guard for unauthorized groups
  bot.use(async (ctx, next) => {
    const chat = ctx.chat;
    if (chat && (chat.type === "group" || chat.type === "supergroup")) {
      const isAuthorized = await sanctuaryRepository.isChatAuthorized(chat.id);
      if (!isAuthorized) {
        try {
          await ctx.reply(UNAUTHORIZED_GROUP_MESSAGE, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          });
        } catch (err) {
          console.warn(`[gatekeeper] Failed to send exit message to ${chat.id}:`, err);
        }
        try {
          await ctx.leaveChat();
        } catch (err) {
          console.warn(`[gatekeeper] Failed to leave chat ${chat.id}:`, err);
        }
        return;
      }
    }
    await next();
  });

  // 3. Whitelist Gatekeeper: Listen for bot being added to a group/supergroup
  bot.on("my_chat_member", async (ctx) => {
    const chat = ctx.chat;
    if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) return;

    const newStatus = ctx.myChatMember.new_chat_member.status;
    if (newStatus === "member" || newStatus === "administrator") {
      const isAuthorized = await sanctuaryRepository.isChatAuthorized(chat.id);
      if (!isAuthorized) {
        try {
          await ctx.reply(UNAUTHORIZED_GROUP_MESSAGE, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          });
        } catch (err) {
          console.warn(`[gatekeeper] Failed to send exit message to ${chat.id}:`, err);
        }
        try {
          await ctx.leaveChat();
        } catch (err) {
          console.warn(`[gatekeeper] Failed to leave chat ${chat.id}:`, err);
        }
      }
    }
  });

  // 4. Throttled user synchronization with Turso
  bot.use(userSyncMiddleware);

  // 5. Role-Based Access Control resolver
  bot.use(rbacMiddleware);

  // 6. Authority & Moderation Commands
  registerAuthorityCommands(bot);

  // 7. Board, Information & Welcome Listener
  registerBoardCommands(bot);

  // 8. Member Participation, Suggestions & Voting Engine
  registerGovernanceCommands(bot);

  // 9. Mystical Lore, Pathways, Tarot & Rituals
  registerMysticalCommands(bot);

  // 10. Global error handling
  bot.catch(errorHandler);

  return bot;
}

export async function setupBotCommands(bot: Bot<MyContext>): Promise<void> {
  try {
    await bot.api.setMyCommands([
      // Board & Information
      { command: "divination", description: "Astrological directory of divine commands" },
      { command: "sacred_laws", description: "View or set Tarot Club sacred decrees" },
      { command: "mysteries", description: "Live overview of sanctuary domain" },
      { command: "fate_records", description: "Activity ledger and top Beyonders" },
      { command: "summoning", description: "Preview or set welcoming rites" },
      { command: "lore", description: "Chronicles and ethos of Grey Fog" },
      // Mystical & Lore
      { command: "pathway", description: "Inquire or choose from 22 pathways" },
      { command: "sequence", description: "Inquire sequence hierarchy and rank" },
      { command: "potion", description: "Retrieve formulas and acting methods" },
      { command: "tarot", description: "Draw guidance from Major Arcana" },
      { command: "fate", description: "Spirit pendulum fortune and prophecy" },
      { command: "prayer", description: "Recite supplication to The Fool" },
      { command: "ritual", description: "Convoke interactive Grey Fog ceremony" },
      // Governance & Community
      { command: "suggest", description: "Submit feature proposal to Council" },
      { command: "idea", description: "Propose events or community initiatives" },
      { command: "report", description: "Report bugs or anomalies to Council" },
      { command: "vote", description: "Participate in or create deliberations" },
      { command: "suggestions", description: "View approved development ledger" },
      // Authority & Moderation
      { command: "council", description: "Tarot Club executive hierarchy" },
      { command: "celestial_worthy", description: "Supreme Owner dossier and awakening" },
      { command: "ascend", description: "Promote Beyonder to council seat" },
      { command: "degrade", description: "Demote council member to Beyonder" },
      { command: "banish", description: "Permanently ban corrupt entity" },
      { command: "exile", description: "Expel entity from sanctuary" },
      { command: "silence", description: "Mute voice in the Grey Fog" },
      { command: "release", description: "Lift silence from Beyonder" },
      { command: "seal", description: "Seal sanctuary from regular speech" },
      { command: "unseal", description: "Lift divine silence from chat" },
      { command: "erase", description: "Purge heretical blasphemy and messages" },
    ]);
    console.log("[Bot] Complete command menu synchronized with Telegram.");
  } catch (err: any) {
    console.warn("[Bot] Note: Telegram command menu setup:", err?.message);
  }
}
