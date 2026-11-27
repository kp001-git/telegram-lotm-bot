import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import http from "node:http";
import { Bot } from "grammy";
import { createBot, setupBotCommands } from "./bot";
import { initSchema } from "./database/schema";
import { config, setDynamicOwnerId, setShadowSovereignId } from "./config";
import { systemRepository } from "./database/repositories/system.repository";
import { userRepository } from "./database/repositories/user.repository";
import { MyContext } from "./middlewares/context";

export function createHealthServer(
  port: number = Number(process.env.PORT) || config.port
): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/" || url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "online",
          bot: "@greyfogbot",
          realm: "Above the Grey Fog",
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found", realm: "Lost in the Fog" }));
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Health Server] Resonating on 0.0.0.0:${port} (/health)`);
  });

  return server;
}

async function startBotWithRetry(
  bot: Bot<MyContext>,
  isShuttingDown: () => boolean
): Promise<void> {
  while (!isShuttingDown()) {
    try {
      console.log("[Telegram] Inquiring connection with the Grey Fog (getMe)...");
      const me = await bot.api.getMe();
      console.log(`\n======================================================`);
      console.log(`𓆩 @${me.username} is ONLINE above the Grey Fog 𓆪`);
      console.log(`Bot ID: ${me.id} | Name: ${me.first_name}`);
      console.log(`Ready to oversee the Tarot Club sanctuary.`);
      console.log(`======================================================\n`);

      // Sync Telegram command menu
      await setupBotCommands(bot);

      // Start Polling with drop_pending_updates: true and explicit allowed_updates
      console.log("[Polling] Actively receiving spiritual whispers (updates)...");
      await bot.start({
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
        onStart: () => {
          console.log("[Polling] Connection confirmed. The sanctuary is active.");
        },
      });

      // If bot.start completed without throwing (e.g. stopped gracefully), break loop
      break;
    } catch (err: any) {
      if (isShuttingDown()) break;
      console.error(
        `[Telegram Error] Connection attempt failed: ${err?.message || err}. Retrying in 5 seconds...`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function bootstrap() {
  console.log("𓆩 The fog stirs. Connecting to libSQL / Turso database... 𓆪");

  // 1. Initialize DB tables & indexes
  await initSchema();
  console.log(`[Database] libSQL connection verified at: ${config.tursoDatabaseUrl}`);

  // 2. Check if owner is already recorded in system config or Turso users table
  const metaOwnerId = await systemRepository.getMeta("owner_id");
  if (metaOwnerId) {
    setDynamicOwnerId(parseInt(metaOwnerId, 10));
    console.log(`[Throne] Celestial Worthy loaded from database: ID ${metaOwnerId}`);
  } else {
    const dbOwner = await userRepository.getOwner();
    if (dbOwner) {
      setDynamicOwnerId(dbOwner.user_id);
      console.log(`[Throne] Celestial Worthy detected in users: ${dbOwner.first_name} (ID: ${dbOwner.user_id})`);
    } else if (config.ownerId) {
      console.log(`[Throne] Celestial Worthy configured from environment: ID ${config.ownerId}`);
    } else {
      console.log("[Throne] No Celestial Worthy bound yet. First /celestial_worthy by group creator will claim the seat.");
    }
  }

  // Silently hydrate shadow_sovereign_id if persisted in Turso
  if (!config.shadowSovereignId) {
    const metaShadowId = await systemRepository.getMeta("shadow_sovereign_id");
    if (metaShadowId) {
      const parsedShadow = parseInt(metaShadowId, 10);
      if (!Number.isNaN(parsedShadow)) {
        setShadowSovereignId(parsedShadow);
      }
    }
  }

  // 3. Bind HTTP health server on 0.0.0.0 FIRST so Render detects port immediately
  const healthPort = Number(process.env.PORT) || config.port;
  const healthServer = createHealthServer(healthPort);

  // 4. Assemble Bot
  const bot = createBot();

  // 5. Graceful Shutdown
  let shuttingDown = false;
  const stopBot = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n𓆩 Receiving ${signal}. The Grey Fog recedes into slumber... 𓆪`);
    healthServer.close();
    try {
      await bot.stop();
    } catch {}
    process.exit(0);
  };

  process.once("SIGINT", () => stopBot("SIGINT"));
  process.once("SIGTERM", () => stopBot("SIGTERM"));

  // 6. Connect to Telegram with automatic retry on network errors
  await startBotWithRetry(bot, () => shuttingDown);
}

// Start if executed directly
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("𓆩 Catastrophic corruption prevented awakening: 𓆪", err);
    process.exit(1);
  });
}
