import { Bot } from "grammy";
import { MyContext } from "../../middlewares/context";
import { groupOnlyGuard } from "../../middlewares/guard";
import { requireRole } from "../../middlewares/rbac";
import { celestialWorthyCommand } from "./celestial_worthy";
import { councilCommand } from "./council";
import { ascendCommand } from "./ascend";
import { degradeCommand } from "./degrade";
import { banishCommand } from "./banish";
import { exileCommand } from "./exile";
import { silenceCommand } from "./silence";
import { releaseCommand } from "./release";
import { sealCommand } from "./seal";
import { unsealCommand } from "./unseal";
import { eraseCommand } from "./erase";
import { corruptCommand } from "./corrupt";
import { purifyCommand, registerCorruptionCallbacks } from "./purify";
import { corruptionCommand } from "./corruption";
import { cleanseCommand } from "./cleanse";
import { whisperCommand } from "./whisper";
import { dispelCommand } from "./dispel";
import { whispersCommand } from "./whispers";
import { wardCommand } from "./ward";
import { bestowCommand } from "./bestow";

export * from "./celestial_worthy";
export * from "./council";
export * from "./ascend";
export * from "./degrade";
export * from "./banish";
export * from "./exile";
export * from "./silence";
export * from "./release";
export * from "./seal";
export * from "./unseal";
export * from "./erase";
export * from "./corrupt";
export * from "./purify";
export * from "./corruption";
export * from "./cleanse";
export * from "./whisper";
export * from "./dispel";
export * from "./whispers";
export * from "./ward";
export * from "./bestow";

export function registerAuthorityCommands(bot: Bot<MyContext>): void {
  // Foundational Information & Binding
  bot.command("celestial_worthy", celestialWorthyCommand);
  bot.command("council", councilCommand);

  // Promotion & Demotion (CELESTIAL_WORTHY, THE_FOOL)
  bot.command(
    "ascend",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL"),
    ascendCommand
  );
  bot.command(
    "degrade",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL"),
    degradeCommand
  );

  // Banishment & Exile (CELESTIAL_WORTHY, THE_FOOL, THE_WORLD)
  bot.command(
    "banish",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD"),
    banishCommand
  );
  bot.command(
    "exile",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD"),
    exileCommand
  );

  // Silence & Release (CELESTIAL_WORTHY, THE_FOOL, THE_WORLD, THE_STAR)
  bot.command(
    "silence",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    silenceCommand
  );
  bot.command(
    "release",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    releaseCommand
  );

  // Sanctuary Sealing (CELESTIAL_WORTHY, THE_FOOL)
  bot.command(
    "seal",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL"),
    sealCommand
  );
  bot.command(
    "unseal",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL"),
    unsealCommand
  );

  // Message Erasure (CELESTIAL_WORTHY, THE_FOOL, THE_WORLD, THE_STAR)
  bot.command(
    "erase",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    eraseCommand
  );

  // Phase B: Corruption / Warn System
  bot.command(
    "corrupt",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    corruptCommand
  );
  bot.command(
    "purify",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    purifyCommand
  );
  bot.command("corruption", groupOnlyGuard, corruptionCommand);
  bot.command(
    "cleanse",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD"),
    cleanseCommand
  );
  registerCorruptionCallbacks(bot);

  // Phase B: Grey Fog Whispers (Auto-Filters)
  bot.command(
    "whisper",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    whisperCommand
  );
  bot.command(
    "dispel",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD", "THE_STAR"),
    dispelCommand
  );
  bot.command("whispers", groupOnlyGuard, whispersCommand);

  // Phase B: Spiritual Ward (Anti-Link)
  bot.command(
    "ward",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD"),
    wardCommand
  );

  // Phase C: Bestow Honorific Position
  bot.command(
    "bestow",
    groupOnlyGuard,
    requireRole("CELESTIAL_WORTHY", "THE_FOOL", "THE_WORLD"),
    bestowCommand
  );
}
