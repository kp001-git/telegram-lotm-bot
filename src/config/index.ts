import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  botToken: string;
  tursoDatabaseUrl: string;
  tursoAuthToken?: string;
  ownerId?: number;
  shadowSovereignId: number | null;
  adminLogChatId?: string;
  port: number;
}

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error("Missing required environment variable: BOT_TOKEN");
}

let dynamicOwnerId: number | undefined = process.env.OWNER_ID
  ? parseInt(process.env.OWNER_ID, 10)
  : undefined;

const envShadowId = process.env.SHADOW_SOVEREIGN_ID
  ? Number(process.env.SHADOW_SOVEREIGN_ID)
  : null;
let cachedShadowSovereignId: number | null =
  envShadowId && !Number.isNaN(envShadowId) ? envShadowId : null;

export const config: AppConfig = {
  botToken,
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL || "file:local.db",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || undefined,
  get ownerId() {
    return dynamicOwnerId;
  },
  get shadowSovereignId() {
    return cachedShadowSovereignId;
  },
  adminLogChatId: process.env.ADMIN_LOG_CHAT_ID || undefined,
  port: parseInt(process.env.PORT || "3000", 10),
};

export function setDynamicOwnerId(id: number) {
  dynamicOwnerId = id;
}

export function setShadowSovereignId(id: number | null): void {
  cachedShadowSovereignId = id;
}

export function isShadowSovereign(userId?: number | null): boolean {
  if (!userId || cachedShadowSovereignId === null) return false;
  return userId === cachedShadowSovereignId;
}
