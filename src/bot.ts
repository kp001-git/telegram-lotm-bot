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

  // 2. Throttled user synchronization with Turso
  bot.use(userSyncMiddleware);

  // 3. Role-Based Access Control resolver
  bot.use(rbacMiddleware);

  // 4. Authority & Moderation Commands
  registerAuthorityCommands(bot);

  // 5. Board, Information & Welcome Listener
  registerBoardCommands(bot);

  // 6. Member Participation, Suggestions & Voting Engine
  registerGovernanceCommands(bot);

  // 7. Mystical Lore, Pathways, Tarot & Rituals
  registerMysticalCommands(bot);

  // 8. Global error handling
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
