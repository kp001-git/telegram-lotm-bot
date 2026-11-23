import { createClient, Client } from "@libsql/client";
import { config } from "../config";

let dbInstance: Client | null = null;

export function getDatabaseClient(): Client {
  if (!dbInstance) {
    const isFile = config.tursoDatabaseUrl.startsWith("file:");
    dbInstance = createClient({
      url: config.tursoDatabaseUrl,
      // libSQL file: urls don't require an authToken and will warn/fail if empty string passed
      authToken: isFile ? undefined : config.tursoAuthToken,
    });
  }
  return dbInstance;
}
