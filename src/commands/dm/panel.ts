import { InlineKeyboard } from "grammy";
import { MyContext } from "../../middlewares/context";
import { verifyDmGroupAdmin } from "../../middlewares/dm-auth";
import { groupRepository } from "../../database/repositories/group.repository";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function buildDmControlPanel(
  ctx: MyContext,
  userId: number,
  chatId: number
): Promise<{
  authorized: boolean;
  text?: string;
  reply_markup?: InlineKeyboard;
}> {
  const isAdmin = await verifyDmGroupAdmin(ctx, userId, chatId);
  if (!isAdmin) {
    await groupRepository.disconnectDmSession(userId);
    return { authorized: false };
  }

  let groupTitle = await groupRepository.getAuthorizedChatTitle(chatId);
  if (!groupTitle) {
    try {
      const chatInfo = await ctx.api.getChat(chatId);
      if ("title" in chatInfo && chatInfo.title) {
        groupTitle = chatInfo.title;
      }
    } catch {
      groupTitle = null;
    }
  }

  const [welcomeCfg, goodbyeCfg, modTemplates, wardCfg, whispers] = await Promise.all([
    groupRepository.getWelcomeConfig(chatId),
    groupRepository.getGoodbyeConfig(chatId),
    groupRepository.getModTemplates(chatId),
    defenseRepository.getWardConfig(chatId),
    defenseRepository.getChatWhispers(chatId),
  ]);

  const domainsPreview =
    wardCfg.ward_whitelist.length > 0
      ? wardCfg.ward_whitelist.map((d) => `<code>${escapeHtml(d)}</code>`).join(", ")
      : "<i>None (total lockdown)</i>";

  const text = [
    formatHeader("DM Sanctuary Control Panel"),
    `<b>Sanctuary:</b> ${escapeHtml(groupTitle || "Tarot Club Sanctuary")}`,
    `<b>Chat ID:</b> <code>${chatId}</code>`,
    formatDivider(),
    `🚪 <b>Welcome Gateway:</b> ${welcomeCfg.enabled ? "<b>ON</b>" : "<b>OFF</b>"}`,
    `🕯 <b>Goodbye Gateway:</b> ${goodbyeCfg.enabled ? "<b>ON</b>" : "<b>OFF</b>"}`,
    `⚔️ <b>Ban Decree:</b> ${modTemplates.ban_template ? "<code>Custom</code>" : "<i>Default Roast</i>"}`,
    `🔇 <b>Mute Decree:</b> ${modTemplates.mute_template ? "<code>Custom</code>" : "<i>Default Roast</i>"}`,
    `🛡 <b>Spiritual Ward:</b> ${wardCfg.ward_enabled === 1 ? "<b>ACTIVE</b>" : "<b>INACTIVE</b>"}`,
    `🌐 <b>Ward Domains:</b> ${domainsPreview}`,
    `👻 <b>Active Whispers:</b> <code>${whispers.size}</code> bound trigger(s)`,
    `🩸 <b>Corruption Policy:</b> <code>${wardCfg.warn_limit}</code> marks → <code>${wardCfg.warn_punishment}</code>`,
    formatDivider(),
    `<i>Tap any seal below to configure this sanctuary silently from DM.</i>`,
  ].join("\n");

  const keyboard = new InlineKeyboard()
    .text(`🚪 Welcome: ${welcomeCfg.enabled ? "ON" : "OFF"}`, "dm:toggle:welcome")
    .text("✍️ Edit Welcome", "dm:prompt:WELCOME_TEXT")
    .row()
    .text(`🕯 Goodbye: ${goodbyeCfg.enabled ? "ON" : "OFF"}`, "dm:toggle:goodbye")
    .text("✍️ Edit Goodbye", "dm:prompt:GOODBYE_TEXT")
    .row()
    .text("⚔️ Edit Ban Decree", "dm:prompt:BAN_DECREE")
    .text("🔇 Edit Mute Decree", "dm:prompt:MUTE_DECREE")
    .row()
    .text(`🛡 Ward: ${wardCfg.ward_enabled === 1 ? "ON" : "OFF"}`, "dm:toggle:ward")
    .text("➕ Allow Domain", "dm:prompt:WARD_ALLOW")
    .text("➖ Remove Domain", "dm:prompt:WARD_DISALLOW")
    .row()
    .text("👻 Add Whisper", "dm:prompt:WHISPER_ADD")
    .text("🗑 Dispel Whisper", "dm:prompt:WHISPER_DEL")
    .row()
    .text(`🩸 Limit: ${wardCfg.warn_limit}`, "dm:cycle:warn_limit")
    .text(`⚖️ Punish: ${wardCfg.warn_punishment}`, "dm:cycle:warn_punishment")
    .row()
    .text("🔄 Switch Sanctuary", "dm:list_groups");

  return { authorized: true, text, reply_markup: keyboard };
}

export async function sendAuthorizedGroupPicker(
  ctx: MyContext,
  userId: number,
  introText?: string
): Promise<void> {
  const groups = await groupRepository.getAdminAuthorizedGroups(userId, ctx.api);

  if (groups.length === 0) {
    await ctx.reply(
      "𓆩 You aren't an admin in a single whitelisted sanctuary. Earn some actual authority in a group first before knocking on my DMs. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const g of groups) {
    const label = g.title ? `${g.title} (${g.chat_id})` : `Sanctuary ${g.chat_id}`;
    keyboard.text(`🏛 ${label}`, `dm:select:${g.chat_id}`).row();
  }

  const msg = [
    formatHeader("Authorized Sanctuaries"),
    introText ||
      "<i>Pick which sanctuary you want to babysit from the shadows:</i>",
  ].join("\n");

  await ctx.reply(msg, { parse_mode: "HTML", reply_markup: keyboard });
}

export async function manageCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  if (chat.type !== "private") {
    await ctx.reply(
      "𓆩 Stop trying to open your admin dashboard in public chat like an amateur. Run <code>/connect</code> here and tap the DM button. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const session = await groupRepository.getDmSession(from.id);
  if (!session) {
    await sendAuthorizedGroupPicker(
      ctx,
      from.id,
      "<i>You're not connected to any sanctuary yet. Choose one below or run <code>/connect &lt;chat_id&gt;</code>:</i>"
    );
    return;
  }

  const panel = await buildDmControlPanel(ctx, from.id, session.active_chat_id);
  if (!panel.authorized || !panel.text) {
    await ctx.reply(
      "𓆩 Looks like you got stripped of admin privileges in that group. Tough luck—your DM access just evaporated. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  await ctx.reply(panel.text, {
    parse_mode: "HTML",
    reply_markup: panel.reply_markup,
  });
}
