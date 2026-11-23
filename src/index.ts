import http from "node:http";
import { createBot } from "./bot";
import { initSchema } from "./database/schema";
import { config, setDynamicOwnerId } from "./config";
import { systemRepository } from "./database/repositories/system.repository";
import { userRepository } from "./database/repositories/user.repository";

export function createHealthServer(port: number = config.port): http.Server {
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

  server.listen(port, () => {
    console.log(`[Health Server] Resonating on port ${port} (/health)`);
  });

  return server;
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

  // 3. Start native HTTP health server for Render / Alwaysdata 24/7 uptime
  const healthServer = createHealthServer(config.port);

  // 4. Assemble Bot
  const bot = createBot();

  // 5. Graceful Shutdown
  const stopBot = async (signal: string) => {
    console.log(`\n𓆩 Receiving ${signal}. The Grey Fog recedes into slumber... 𓆪`);
    healthServer.close();
    await bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => stopBot("SIGINT"));
  process.once("SIGTERM", () => stopBot("SIGTERM"));

  // 6. Fetch bot info to confirm token and connection
  const me = await bot.api.getMe();
  console.log(`\n======================================================`);
  console.log(`𓆩 @${me.username} is ONLINE above the Grey Fog 𓆪`);
  console.log(`Bot ID: ${me.id} | Name: ${me.first_name}`);
  console.log(`Ready to oversee the Tarot Club sanctuary.`);
  console.log(`======================================================\n`);

  // 7. Sync Telegram command menu
  const { setupBotCommands } = await import("./bot");
  await setupBotCommands(bot);

  // 8. Start Polling with drop_pending_updates: true
  await bot.start({
    drop_pending_updates: true,
    onStart: () => {
      console.log("[Polling] Actively receiving spiritual whispers (updates)...");
    },
  });
}

// Start if executed directly
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("𓆩 Catastrophic corruption prevented awakening: 𓆪", err);
    process.exit(1);
  });
}
