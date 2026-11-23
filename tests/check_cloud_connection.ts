import { getDatabaseClient } from "../src/database/client";
import { initSchema } from "../src/database/schema";
import { config } from "../src/config";

async function verifyCloudConnection() {
  console.log("𓆩 The fog stirs. Connecting to Turso Cloud... 𓆪");
  console.log(`[Config] Target URL: ${config.tursoDatabaseUrl}`);
  console.log(`[Config] Auth Token length: ${config.tursoAuthToken?.length || 0} characters`);

  const client = getDatabaseClient();

  // 1. Initialize schema against Turso Cloud
  console.log("[Migration] Executing batch schema initialization...");
  await initSchema(client);
  console.log("✔ Batch schema execution succeeded.");

  // 2. Query sqlite_master to verify tables
  const result = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;`,
    args: [],
  });

  const tableNames = result.rows.map((r) => r.name as string);
  console.log("\n[Verification] Verified tables in Turso Cloud:");
  tableNames.forEach((name) => console.log(` • ${name}`));

  const expectedTables = [
    "audit_logs",
    "group_settings",
    "poll_votes",
    "polls",
    "suggestions",
    "system_config",
    "users",
  ];

  const missing = expectedTables.filter((t) => !tableNames.includes(t));
  if (missing.length > 0) {
    throw new Error(`Missing expected tables in Turso Cloud: ${missing.join(", ")}`);
  }

  // 3. Quick test query against users table
  const userCountRes = await client.execute({
    sql: `SELECT COUNT(*) as count FROM users;`,
    args: [],
  });
  console.log(`\n[Status] Current tracked Beyonders in Turso Cloud: ${userCountRes.rows[0].count}`);

  console.log("\n𓆩 @greyfogbot is cleanly connected to Turso Cloud with zero errors! 𓆪\n");
}

verifyCloudConnection().catch((err) => {
  console.error("Cloud connection verification failed:", err);
  process.exit(1);
});
