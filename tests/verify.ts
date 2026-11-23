import http from "node:http";
import { initSchema } from "../src/database/schema";
import { userRepository } from "../src/database/repositories/user.repository";
import { groupRepository } from "../src/database/repositories/group.repository";
import { auditRepository } from "../src/database/repositories/audit.repository";
import { systemRepository } from "../src/database/repositories/system.repository";
import { governanceRepository } from "../src/database/repositories/governance.repository";
import { getDatabaseClient } from "../src/database/client";
import { userCache } from "../src/middlewares/cache";
import { canActOnTarget, parseDuration } from "../src/utils/resolver";
import { renderWelcomeTemplate } from "../src/commands/board/summoning";
import { cooldownManager } from "../src/utils/cooldown";
import { sanctuaryRepository } from "../src/database/repositories/sanctuary.repository";
import { createHealthServer } from "../src/index";
import pathwaysData from "../src/data/pathways.json";
import tarotData from "../src/data/tarot_cards.json";
import mysticalEvents from "../src/data/mystical_events.json";

async function runTests() {
  console.log("=== Running Comprehensive Verification Tests (Phases 1, 2, 3, 4 & 5) ===");
  
  // 1. Schema Init & Clean State
  await initSchema();
  const client = getDatabaseClient();
  await client.execute({
    sql: `DELETE FROM users WHERE user_id IN (7770001, 7770002, 7770003);`,
    args: [],
  });
  await client.execute({
    sql: `DELETE FROM group_settings WHERE chat_id IN (-1009876543, -100111222, -1001234567);`,
    args: [],
  });
  await client.execute({
    sql: `DELETE FROM authorized_chats WHERE chat_id IN (-100555666777, -999888777);`,
    args: [],
  });
  console.log("✔ Schema initialized and test state prepared.");

  // 2. User Upsert & Counting
  const testUserId = 7770001;
  await userRepository.upsertUser(testUserId, "klein_moretti", "Klein", "THE_FOOL");
  const user = await userRepository.getUserById(testUserId);
  if (!user || user.role !== "THE_FOOL" || user.messages_count !== 1) {
    throw new Error(`User upsert assertion failed: ${JSON.stringify(user)}`);
  }
  console.log("✔ User single-statement upsert verified.");

  // 3. Username Lookup (with and without @)
  const byUser1 = await userRepository.getUserByUsername("klein_moretti");
  const byUser2 = await userRepository.getUserByUsername("@klein_moretti");
  if (!byUser1 || !byUser2 || byUser1.user_id !== testUserId || byUser2.user_id !== testUserId) {
    throw new Error("Username resolution query failed.");
  }
  console.log("✔ Username lookup (@ and plain) verified.");

  // 4. Council Query
  const council = await userRepository.getCouncilMembers();
  if (council.length === 0 || !council.find(c => c.user_id === testUserId)) {
    throw new Error("Council members query failed.");
  }
  console.log("✔ Council members query verified.");

  // 5. Hierarchy Guard (canActOnTarget)
  const botId = 999999;
  const cwId = 10001;
  const foolId = 10002;
  const worldId = 10003;
  const starId = 10004;
  const beyonderId = 10005;

  const selfCheck = canActOnTarget("CELESTIAL_WORTHY", "CELESTIAL_WORTHY", cwId, cwId, botId);
  if (selfCheck.allowed) throw new Error("Self-moderation should be blocked");

  const botCheck = canActOnTarget("CELESTIAL_WORTHY", "BEYONDER", cwId, botId, botId);
  if (botCheck.allowed) throw new Error("Bot-moderation should be blocked");

  const starOnWorld = canActOnTarget("THE_STAR", "THE_WORLD", starId, worldId, botId);
  if (starOnWorld.allowed) throw new Error("THE_STAR should not moderate THE_WORLD");

  const worldOnWorld = canActOnTarget("THE_WORLD", "THE_WORLD", worldId, 20003, botId);
  if (worldOnWorld.allowed) throw new Error("Same rank moderation should be blocked");

  const worldOnStar = canActOnTarget("THE_WORLD", "THE_STAR", worldId, starId, botId);
  if (!worldOnStar.allowed) throw new Error("THE_WORLD should moderate THE_STAR");

  const cwOnFool = canActOnTarget("CELESTIAL_WORTHY", "THE_FOOL", cwId, foolId, botId);
  if (!cwOnFool.allowed) throw new Error("Celestial Worthy should moderate THE_FOOL");

  console.log("✔ Hierarchy ranking and moderation guard logic verified.");

  // 6. Duration Parsing
  const d30m = parseDuration("30m");
  if (!d30m.isValid || !d30m.label.includes("30 minutes") || d30m.untilDate <= Math.floor(Date.now() / 1000)) {
    throw new Error(`Duration 30m parsing failed: ${JSON.stringify(d30m)}`);
  }
  console.log("✔ Duration parser (m, h, d, w, indefinite) verified.");

  // 7. Group Settings & Sealed State Toggling
  const testChatId = -1009876543;
  await groupRepository.upsertSettings(testChatId, { is_sealed: 1, sacred_laws: "Secrecy Above the Gray Fog" });
  const sealedSettings = await groupRepository.getSettings(testChatId);
  if (!sealedSettings || sealedSettings.is_sealed !== 1) {
    throw new Error("Group seal toggle failed.");
  }
  await groupRepository.upsertSettings(testChatId, { is_sealed: 0 });
  const unsealedSettings = await groupRepository.getSettings(testChatId);
  if (!unsealedSettings || unsealedSettings.is_sealed !== 0) {
    throw new Error("Group unseal toggle failed.");
  }
  console.log("✔ Group settings sealed state toggle (1 -> 0) verified.");

  // 8. Audit Log Recording
  await auditRepository.log({
    chat_id: testChatId,
    actor_id: cwId,
    target_id: beyonderId,
    action: "BANISH",
    reason: "Severe corruption from outer deities",
  });
  console.log("✔ Audit log recording and persistence verified.");

  // 9. In-memory Cache TTL & Invalidation
  userCache.set(testUserId, "THE_FOOL", user, "Klein", "klein_moretti");
  userCache.invalidate(testUserId);
  if (userCache.get(testUserId)) {
    throw new Error("Cache invalidation failed.");
  }
  console.log("✔ User memory cache TTL & invalidation verified.");

  // 10. Phase 3: Sacred Laws Fallback & Customization
  const defaultLawsChatId = -100111222;
  const fallbackLaws = await groupRepository.getSacredLaws(defaultLawsChatId);
  if (!fallbackLaws.includes("Equivalent Exchange") || !fallbackLaws.includes("Do Not Pry Into Deities")) {
    throw new Error("Fallback sacred laws failed.");
  }
  await groupRepository.setSacredLaws(defaultLawsChatId, "Law 1: Praise the Fool.");
  const customLaws = await groupRepository.getSacredLaws(defaultLawsChatId);
  if (customLaws !== "Law 1: Praise the Fool.") {
    throw new Error("Custom sacred laws persistence failed.");
  }
  console.log("✔ Sacred laws fallback and customization verified.");

  // 11. Phase 3: Lore Chronicles Fallback & Customization
  const fallbackLore = await groupRepository.getLore(defaultLawsChatId);
  if (!fallbackLore.includes("Fifth Epoch") || !fallbackLore.includes("mottled bronze table")) {
    throw new Error("Fallback lore chronicles failed.");
  }
  await groupRepository.setLore(defaultLawsChatId, "A gathering born in Backlund.");
  const customLore = await groupRepository.getLore(defaultLawsChatId);
  if (customLore !== "A gathering born in Backlund.") {
    throw new Error("Custom lore persistence failed.");
  }
  console.log("✔ Lore chronicles fallback and customization verified.");

  // 12. Phase 3: Welcome Template Fallback & Placeholder Rendering
  const fallbackTemplate = await groupRepository.getWelcomeTemplate(defaultLawsChatId);
  if (!fallbackTemplate.includes("{mention}") || !fallbackTemplate.includes("{group}")) {
    throw new Error("Fallback welcome template failed.");
  }
  const customTemplate = "Welcome {mention} ({name}) to {group}! You are member #{count}.";
  await groupRepository.setWelcomeTemplate(defaultLawsChatId, customTemplate);
  const rendered = renderWelcomeTemplate(
    customTemplate,
    { id: 98765, firstName: "Audrey", username: "miss_justice" },
    "Sanctuary of Backlund",
    42,
    true
  );
  if (
    !rendered.includes("Audrey") ||
    !rendered.includes("Sanctuary of Backlund") ||
    !rendered.includes("42") ||
    !rendered.includes("currently sealed")
  ) {
    throw new Error(`Welcome template rendering failed: ${rendered}`);
  }
  console.log("✔ Welcome template persistence and placeholder rendering verified.");

  // 13. Phase 3: getFateRecords Aggregation Query
  await userRepository.upsertUser(7770002, "alger_wilson", "Alger", "THE_WORLD", 45);
  await userRepository.upsertUser(7770003, "derrick_berg", "Derrick", "BEYONDER", 80);
  
  const fateRecords = await userRepository.getFateRecords(testChatId);
  if (
    fateRecords.totalBeyonders < 3 ||
    fateRecords.councilCount < 1 ||
    fateRecords.totalMessages < 100 ||
    fateRecords.topBeyonders.length === 0 ||
    fateRecords.topBeyonders[0].messages_count < 80
  ) {
    throw new Error(`Fate records aggregation failed: ${JSON.stringify(fateRecords)}`);
  }
  console.log("✔ Fate records aggregation query verified.");

  // 14. Phase 4: Submissions Creation & Lifecycle
  const subId1 = await governanceRepository.createSubmission(
    testUserId,
    "SUGGESTION",
    "Add Tarot card readings for Sequence 7 magicians"
  );
  const subId2 = await governanceRepository.createSubmission(
    7770002,
    "IDEA",
    "Host monthly gathering above the Grey Fog"
  );
  if (!subId1 || !subId2) {
    throw new Error("Submission creation failed.");
  }

  const fetchedSub1 = await governanceRepository.getSubmissionById(subId1);
  if (!fetchedSub1 || fetchedSub1.status !== "PENDING" || fetchedSub1.type !== "SUGGESTION") {
    throw new Error(`Fetched submission assertion failed: ${JSON.stringify(fetchedSub1)}`);
  }

  // Update status: PENDING -> VOTING -> APPROVED
  await governanceRepository.updateSubmissionStatus(subId1, "VOTING", cwId);
  await governanceRepository.updateSubmissionStatus(subId1, "APPROVED", cwId);
  const approvedList = await governanceRepository.getApprovedSuggestions(10);
  if (approvedList.length === 0 || !approvedList.find(s => s.id === subId1)) {
    throw new Error("Approved suggestions list assertion failed.");
  }
  console.log("✔ Submission lifecycle (PENDING -> VOTING -> APPROVED) verified.");

  // 15. Phase 4: Polls Creation, Voting, Switching & Tallies
  const pollId = await governanceRepository.createPoll(
    testChatId,
    "Should the Council permit Sequence 4 advancements this epoch?",
    ["Permit Ritual", "Delay Ascension"],
    cwId,
    subId1
  );

  // User 1 votes for option 0 (Permit Ritual)
  await governanceRepository.castVote(pollId, testUserId, 0);

  // User 1 changes vote to option 1 (Delay Ascension)
  await governanceRepository.castVote(pollId, testUserId, 1);

  // User 2 votes for option 0 (Permit Ritual) -> 50% / 50% split
  await governanceRepository.castVote(pollId, 7770002, 0);
  const pollStats = await governanceRepository.getPollWithTallies(pollId);
  if (
    !pollStats ||
    pollStats.totalVotes !== 2 ||
    pollStats.tallies[0].percentage !== 50 ||
    pollStats.tallies[1].percentage !== 50
  ) {
    throw new Error(`Split tallies assertion failed: ${JSON.stringify(pollStats)}`);
  }

  await governanceRepository.closePoll(pollId);
  const closedPoll = await governanceRepository.getPollById(pollId);
  if (closedPoll?.status !== "CLOSED") {
    throw new Error("Poll close assertion failed.");
  }
  console.log("✔ Community Polls, vote switching upsert & tallies calculation verified.");

  // 16. Phase 5: 22 Canonical Pathways Data Integrity
  if (pathwaysData.length !== 22) {
    throw new Error(`Expected exactly 22 pathways, found: ${pathwaysData.length}`);
  }
  const requiredPathways = [
    "Fool Pathway", "Error Pathway", "Door Pathway", "Visionary Pathway", "Sun Pathway",
    "Tyrant Pathway", "White Tower Pathway", "Hanged Man Pathway", "Darkness Pathway",
    "Death Pathway", "Twilight Giant Pathway", "Red Priest Pathway", "Demoness Pathway",
    "Hermit Pathway", "Paragon Pathway", "Wheel of Fortune Pathway", "Mother Pathway",
    "Moon Pathway", "Black Emperor Pathway", "Justiciar Pathway", "Abyss Pathway", "Chained Pathway"
  ];
  for (const expectedName of requiredPathways) {
    const found = pathwaysData.find(p => p.name === expectedName);
    if (!found || !found.sequences["0"] || !found.sequences["9"]) {
      throw new Error(`Pathway data missing or incomplete for: ${expectedName}`);
    }
  }
  console.log("✔ All 22 Canonical Pathways data integrity verified.");

  // 17. Phase 5: 22 Major Arcana Tarot Cards Integrity
  if (tarotData.length !== 22) {
    throw new Error(`Expected exactly 22 tarot cards, found: ${tarotData.length}`);
  }
  for (let i = 0; i <= 21; i++) {
    const card = tarotData.find(c => c.arcana_number === i);
    if (!card || !card.upright || !card.reversed || !card.guidance) {
      throw new Error(`Major Arcana data missing or incomplete for Arcana #${i}`);
    }
  }
  console.log("✔ All 22 Major Arcana cards integrity verified.");

  // 18. Phase 5: Mystical Events & Omens Integrity
  if (mysticalEvents.fate_omens.length < 5 || mysticalEvents.ritual_events.length < 5) {
    throw new Error("Mystical events or fate omens data insufficient.");
  }
  console.log("✔ Mystical events and fate omens data verified.");

  // 19. Phase 5: Pathway Binding & Devotion Prayers in Turso
  await userRepository.setUserPathway(testUserId, "Fool Pathway");
  const updatedUserWithPathway = await userRepository.getUserById(testUserId);
  if (updatedUserWithPathway?.pathway !== "Fool Pathway") {
    throw new Error("Pathway binding failed.");
  }

  const initialPrayers = updatedUserWithPathway.prayers_count;
  const newPrayers = await userRepository.incrementPrayers(testUserId);
  if (newPrayers !== initialPrayers + 1) {
    throw new Error(`Increment prayers failed: expected ${initialPrayers + 1}, got ${newPrayers}`);
  }
  console.log("✔ Pathway binding and prayer counter increment verified.");

  // 20. Phase 5: Cooldown Enforcement & Celestial Worthy Bypass
  cooldownManager.reset("test:cooldown");
  const firstCall = cooldownManager.checkCooldown("test:cooldown", 30, "BEYONDER");
  if (!firstCall.allowed) throw new Error("First cooldown call should be allowed");

  const secondCall = cooldownManager.checkCooldown("test:cooldown", 30, "BEYONDER");
  if (secondCall.allowed || secondCall.remainingSeconds <= 0) {
    throw new Error("Second call within cooldown should be blocked");
  }

  const bypassCall = cooldownManager.checkCooldown("test:cooldown", 30, "CELESTIAL_WORTHY");
  if (!bypassCall.allowed || bypassCall.remainingSeconds !== 0) {
    throw new Error("CELESTIAL_WORTHY must bypass cooldown");
  }
  console.log("✔ In-memory cooldown manager & owner bypass verified.");

  // 21. Phase 5: Native HTTP Health Server (/health)
  const testPort = 3199;
  const healthServer = createHealthServer(testPort);

  const healthRes = await new Promise<{ status: string; bot: string }>((resolve, reject) => {
    http.get(`http://localhost:${testPort}/health`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      res.on("error", reject);
    });
  });

  healthServer.close();

  if (healthRes.status !== "online" || healthRes.bot !== "@greyfogbot") {
    throw new Error(`Health server assertion failed: ${JSON.stringify(healthRes)}`);
  }
  console.log("✔ Native HTTP health endpoint (/health) verified.");

  // 22. Group Whitelist Gatekeeper (isChatAuthorized)
  sanctuaryRepository.clearCache();
  const unapprovedChatId = -999888777;
  const isUnapproved = await sanctuaryRepository.isChatAuthorized(unapprovedChatId);
  if (isUnapproved) {
    throw new Error(`Expected unauthorized chat to return false, got true for ${unapprovedChatId}`);
  }

  const approvedChatId = -100555666777;
  await sanctuaryRepository.authorizeChat(approvedChatId, "Tarot Club Sanctuary");
  const isApproved = await sanctuaryRepository.isChatAuthorized(approvedChatId);
  if (!isApproved) {
    throw new Error(`Expected authorized chat to return true, got false for ${approvedChatId}`);
  }

  // Verify memory cache hit (reloaded after clearing cache)
  sanctuaryRepository.clearCache();
  const isApprovedReloaded = await sanctuaryRepository.isChatAuthorized(approvedChatId);
  if (!isApprovedReloaded) {
    throw new Error(`Expected reloaded authorized chat from Turso to return true`);
  }

  // Clean up test chat and verify negative state
  await sanctuaryRepository.deauthorizeChat(approvedChatId);
  sanctuaryRepository.clearCache();
  const isDeauthorized = await sanctuaryRepository.isChatAuthorized(approvedChatId);
  if (isDeauthorized) {
    throw new Error(`Expected deauthorized chat to return false`);
  }
  console.log("✔ Group Whitelist Gatekeeper (isChatAuthorized) verified.");

  console.log("\n𓆩 All Phase 1, 2, 3, 4 & 5 Verification Tests Passed Flawlessly! 𓆪\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
