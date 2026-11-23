import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { systemRepository } from "../../database/repositories/system.repository";
import { config, setDynamicOwnerId } from "../../config";
import { formatHeader, formatDivider, formatUserMention, escapeHtml } from "../../utils/formatters";
import { userCache } from "../../middlewares/cache";

export async function celestialWorthyCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  // Check if owner is already set
  let currentOwner = await userRepository.getOwner();
  let ownerId = config.ownerId || (currentOwner ? currentOwner.user_id : undefined);

  // If no owner is bound yet, check if caller is Telegram group creator
  if (!ownerId && ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup")) {
    try {
      const member = await ctx.getChatMember(from.id);
      if (member.status === "creator") {
        // Auto-bind group creator as Celestial Worthy
        await userRepository.upsertUser(from.id, from.username || null, from.first_name, "CELESTIAL_WORTHY");
        await userRepository.setRole(from.id, "CELESTIAL_WORTHY");
        await systemRepository.setMeta("owner_id", from.id.toString());
        setDynamicOwnerId(from.id);
        userCache.invalidate(from.id);

        currentOwner = await userRepository.getUserById(from.id);
        ownerId = from.id;

        const boundMessage = [
          formatHeader("The Throne of the Celestial Worthy"),
          `The seal has broken. <b>${formatUserMention(from.id, from.first_name, from.username)}</b> has been recognized by the ancient spirit world as the group Creator and is now enthroned as:`,
          `\n<b>𓆩 Celestial Worthy of Heaven and Earth for Blessings 𓆪</b>`,
          `\n<i>All authorities, divine seals, and executive councils of the Tarot Club now answer to your mandate.</i>`,
          formatDivider(),
          `<b>Engine:</b> <code>libSQL / Turso Persistent Cloud</code>`,
          `<b>Domain:</b> Sanctuary Group (${escapeHtml(ctx.chat.title || "Tarot Club")})`,
        ].join("\n");

        await ctx.reply(boundMessage, { parse_mode: "HTML" });
        return;
      }
    } catch (err) {
      console.error("[celestial_worthy] Error checking creator status:", err);
    }
  }

  // Display status of the Celestial Worthy
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  let ownerDossier = "";
  if (currentOwner) {
    ownerDossier = [
      `<b>Supreme Sovereign:</b> ${formatUserMention(currentOwner.user_id, currentOwner.first_name, currentOwner.username)}`,
      `<b>Beyonder ID:</b> <code>${currentOwner.user_id}</code>`,
      `<b>Title:</b> Celestial Worthy of Heaven and Earth for Blessings`,
      `<b>Domain:</b> Lord of the Mysteries; Ruler Above the Gray Fog`,
    ].join("\n");
  } else if (config.ownerId) {
    ownerDossier = [
      `<b>Supreme Sovereign:</b> Beyonder <code>${config.ownerId}</code> (Configured)`,
      `<b>Title:</b> Celestial Worthy of Heaven and Earth for Blessings`,
      `<b>Domain:</b> Lord of the Mysteries; Ruler Above the Gray Fog`,
    ].join("\n");
  } else {
    ownerDossier = [
      `<b>Supreme Sovereign:</b> <i>Unclaimed Throne</i>`,
      `<i>The group creator may run /celestial_worthy to bind their divine authority.</i>`,
    ].join("\n");
  }

  const message = [
    formatHeader("The Celestial Worthy"),
    ownerDossier,
    formatDivider(),
    `<b>Authority Scope:</b> Complete sovereignty over all sequences, decrees, and council seats.`,
    `<b>Spirit Connection:</b> <code>Online above the Grey Fog</code>`,
    `<b>Cloud Sanctuary:</b> <code>libSQL / Turso (${config.tursoDatabaseUrl.startsWith("file:") ? "Local Engine" : "Turso Cloud"})</code>`,
    `<b>Resonance Uptime:</b> <code>${uptimeStr}</code>`,
  ].join("\n");

  await ctx.reply(message, { parse_mode: "HTML" });
}
