import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  botToken: string;
  tursoDatabaseUrl: string;
  tursoAuthToken?: string;
  ownerId?: number;
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

export const config: AppConfig = {
  botToken,
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL || "file:local.db",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || undefined,
  get ownerId() {
    return dynamicOwnerId;
  },
  adminLogChatId: process.env.ADMIN_LOG_CHAT_ID || undefined,
  port: parseInt(process.env.PORT || "3000", 10),
};

export function setDynamicOwnerId(id: number) {
  dynamicOwnerId = id;
}
