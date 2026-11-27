import { Bot, InlineKeyboard } from "grammy";
import { MyContext } from "../../middlewares/context";
import { verifyDmGroupAdmin } from "../../middlewares/dm-auth";
import { groupRepository } from "../../database/repositories/group.repository";
import { defenseRepository, WarnPunishment } from "../../database/repositories/defense.repository";
import { buildDmControlPanel, sendAuthorizedGroupPicker } from "./panel";
import { formatHeader, escapeHtml } from "../../utils/formatters";

const PROMPT_INSTRUCTIONS: Record<string, string> = {
  WELCOME_TEXT:
    "✍️ <b>Send the new Welcome template</b> now.\n\n<b>Placeholders:</b> <code>{mention}</code>, <code>{name}</code>, <code>{group}</code>, <code>{count}</code>\n<i>Send /cancel to abort.</i>",
  GOODBYE_TEXT:
    "✍️ <b>Send the new Goodbye template</b> now.\n\n<b>Placeholders:</b> <code>{mention}</code>, <code>{name}</code>, <code>{group}</code>, <code>{count}</code>\n<i>Send /cancel to abort.</i>",
  BAN_DECREE:
    "⚔️ <b>Send the new Ban (/banish) decree template</b> now, or send <code>reset</code> to restore the default roast.\n\n<b>Placeholders:</b> <code>{mention}</code>, <code>{name}</code>, <code>{reason}</code>, <code>{duration}</code>\n<i>Send /cancel to abort.</i>",
  MUTE_DECREE:
    "🔇 <b>Send the new Mute (/silence) decree template</b> now, or send <code>reset</code> to restore the default roast.\n\n<b>Placeholders:</b> <code>{mention}</code>, <code>{name}</code>, <code>{reason}</code>, <code>{duration}</code>\n<i>Send /cancel to abort.</i>",
  WARD_ALLOW:
    "➕ <b>Send the domain to whitelist</b> (e.g. <code>youtube.com</code>).\n<i>Send /cancel to abort.</i>",
  WARD_DISALLOW:
    "➖ <b>Send the domain to remove</b> from the Spiritual Ward whitelist.\n<i>Send /cancel to abort.</i>",
  WHISPER_ADD:
    '👻 <b>Send the new Whisper trigger &amp; reply</b>:\n• Text: <code>fool Praise The Fool!</code> or <code>"praise the fool" Glory!</code>\n• Media: Send a GIF/Photo with caption <code>&lt;trigger&gt;</code> (or reply to a Sticker with <code>&lt;trigger&gt;</code>).\n<i>Send /cancel to abort.</i>',
  WHISPER_DEL:
    "🗑 <b>Send the trigger keyword to dispel</b>.\n<i>Send /cancel to abort.</i>",
};

export function registerDmCallbacks(bot: Bot<MyContext>): void {
  // 1. Select sanctuary from picker: dm:select:<chat_id>
  bot.callbackQuery(/^dm:select:(-?\d+)$/, async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const targetChatId = Number(ctx.match[1]);
    const isAdmin = await verifyDmGroupAdmin(ctx, from.id, targetChatId);
    if (!isAdmin) {
      await ctx.answerCallbackQuery({
        text: "𓆩 Access denied. You hold no admin power in that sanctuary. 𓆪",
        show_alert: true,
      });
      return;
    }

    await groupRepository.setDmSession(from.id, targetChatId, null);
    const panel = await buildDmControlPanel(ctx, from.id, targetChatId);

    if (!panel.authorized || !panel.text) {
      await ctx.answerCallbackQuery({ text: "𓆩 Authorization failed. 𓆪", show_alert: true });
      return;
    }

    try {
      await ctx.editMessageText(panel.text, {
        parse_mode: "HTML",
        reply_markup: panel.reply_markup,
      });
    } catch {
      await ctx.reply(panel.text, {
        parse_mode: "HTML",
        reply_markup: panel.reply_markup,
      });
    }

    await ctx.answerCallbackQuery({ text: "𓆩 Sanctuary connected. 𓆪" });
  });

  // 2. List/Switch authorized groups: dm:list_groups
  bot.callbackQuery("dm:list_groups", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const groups = await groupRepository.getAdminAuthorizedGroups(from.id, ctx.api);
    if (groups.length === 0) {
      await ctx.answerCallbackQuery({
        text: "𓆩 No whitelisted sanctuaries found under your authority. 𓆪",
        show_alert: true,
      });
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const g of groups) {
      const label = g.title ? `${g.title} (${g.chat_id})` : `Sanctuary ${g.chat_id}`;
      keyboard.text(`🏛 ${label}`, `dm:select:${g.chat_id}`).row();
    }

    const msg = [
      formatHeader("Switch Sanctuary"),
      "<i>Pick which sanctuary you want to manage:</i>",
    ].join("\n");

    try {
      await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    } catch {
      await sendAuthorizedGroupPicker(ctx, from.id);
    }

    await ctx.answerCallbackQuery();
  });

  // 3. Toggle Welcome / Goodbye / Ward: dm:toggle:(welcome|goodbye|ward)
  bot.callbackQuery(/^dm:toggle:(welcome|goodbye|ward)$/, async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const session = await groupRepository.getDmSession(from.id);
    if (!session) {
      await ctx.answerCallbackQuery({
        text: "𓆩 No active sanctuary session. Run /connect first. 𓆪",
        show_alert: true,
      });
      return;
    }

    const chatId = session.active_chat_id;
    const isAdmin = await verifyDmGroupAdmin(ctx, from.id, chatId);
    if (!isAdmin) {
      await groupRepository.disconnectDmSession(from.id);
      await ctx.answerCallbackQuery({
        text: "𓆩 Your admin status in that group expired. Nice try. 𓆪",
        show_alert: true,
      });
      return;
    }

    const target = ctx.match[1];
    if (target === "welcome") {
      const cur = await groupRepository.getWelcomeConfig(chatId);
      await groupRepository.setWelcomeEnabled(chatId, !cur.enabled);
    } else if (target === "goodbye") {
      const cur = await groupRepository.getGoodbyeConfig(chatId);
      await groupRepository.setGoodbyeEnabled(chatId, !cur.enabled);
    } else if (target === "ward") {
      const cur = await defenseRepository.getWardConfig(chatId);
      await defenseRepository.setWardEnabled(chatId, cur.ward_enabled !== 1);
    }

    const panel = await buildDmControlPanel(ctx, from.id, chatId);
    if (panel.authorized && panel.text) {
      try {
        await ctx.editMessageText(panel.text, {
          parse_mode: "HTML",
          reply_markup: panel.reply_markup,
        });
      } catch {
        // Ignore if identical
      }
    }

    await ctx.answerCallbackQuery({ text: "𓆩 Sanctuary setting updated. 𓆪" });
  });

  // 4. Cycle Corruption Limit / Punishment: dm:cycle:(warn_limit|warn_punishment)
  bot.callbackQuery(/^dm:cycle:(warn_limit|warn_punishment)$/, async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const session = await groupRepository.getDmSession(from.id);
    if (!session) {
      await ctx.answerCallbackQuery({
        text: "𓆩 No active sanctuary session. Run /connect first. 𓆪",
        show_alert: true,
      });
      return;
    }

    const chatId = session.active_chat_id;
    const isAdmin = await verifyDmGroupAdmin(ctx, from.id, chatId);
    if (!isAdmin) {
      await groupRepository.disconnectDmSession(from.id);
      await ctx.answerCallbackQuery({
        text: "𓆩 Your admin status in that group expired. 𓆪",
        show_alert: true,
      });
      return;
    }

    const field = ctx.match[1];
    const cur = await defenseRepository.getWardConfig(chatId);

    if (field === "warn_limit") {
      const nextLimit = cur.warn_limit === 3 ? 4 : cur.warn_limit === 4 ? 5 : 3;
      await groupRepository.updateCorruptionPolicy(chatId, nextLimit, cur.warn_punishment);
    } else {
      const order: WarnPunishment[] = ["SILENCE", "EXILE", "BANISH"];
      const idx = order.indexOf(cur.warn_punishment);
      const nextPunishment = order[(idx + 1) % order.length];
      await groupRepository.updateCorruptionPolicy(chatId, cur.warn_limit, nextPunishment);
    }

    const panel = await buildDmControlPanel(ctx, from.id, chatId);
    if (panel.authorized && panel.text) {
      try {
        await ctx.editMessageText(panel.text, {
          parse_mode: "HTML",
          reply_markup: panel.reply_markup,
        });
      } catch {
        // Ignore if identical
      }
    }

    await ctx.answerCallbackQuery({ text: "𓆩 Corruption policy updated. 𓆪" });
  });

  // 5. Prompt for text/media input: dm:prompt:<KEY>
  bot.callbackQuery(/^dm:prompt:([A-Z_]+)$/, async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const promptKey = ctx.match[1];
    const instruction = PROMPT_INSTRUCTIONS[promptKey];
    if (!instruction) {
      await ctx.answerCallbackQuery();
      return;
    }

    const session = await groupRepository.getDmSession(from.id);
    if (!session) {
      await ctx.answerCallbackQuery({
        text: "𓆩 No active sanctuary session. Run /connect first. 𓆪",
        show_alert: true,
      });
      return;
    }

    const chatId = session.active_chat_id;
    const isAdmin = await verifyDmGroupAdmin(ctx, from.id, chatId);
    if (!isAdmin) {
      await groupRepository.disconnectDmSession(from.id);
      await ctx.answerCallbackQuery({
        text: "𓆩 Your admin status in that group expired. 𓆪",
        show_alert: true,
      });
      return;
    }

    await groupRepository.setDmPendingInput(from.id, promptKey);

    let extraInfo = "";
    if (promptKey === "WARD_DISALLOW") {
      const cfg = await defenseRepository.getWardConfig(chatId);
      const list =
        cfg.ward_whitelist.length > 0
          ? cfg.ward_whitelist.map((d) => `<code>${escapeHtml(d)}</code>`).join(", ")
          : "<i>None</i>";
      extraInfo = `\n\n<b>Current Whitelist:</b> ${list}`;
    } else if (promptKey === "WHISPER_DEL") {
      const whispers = await defenseRepository.getChatWhispers(chatId);
      const list =
        whispers.size > 0
          ? Array.from(whispers.keys())
              .map((k) => `<code>${escapeHtml(k)}</code>`)
              .join(", ")
          : "<i>None</i>";
      extraInfo = `\n\n<b>Active Triggers:</b> ${list}`;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(`${instruction}${extraInfo}`, { parse_mode: "HTML" });
  });
}
