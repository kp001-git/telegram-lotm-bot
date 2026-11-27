import { InlineKeyboard } from "grammy";
import { MyContext } from "../../middlewares/context";
import { verifyDmGroupAdmin } from "../../middlewares/dm-auth";
import { groupRepository } from "../../database/repositories/group.repository";
import { buildDmControlPanel, sendAuthorizedGroupPicker } from "./panel";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function connectCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  // 1. Inside a Group / Supergroup: provide deep-link button to DM
  if (chat.type === "group" || chat.type === "supergroup") {
    const isAdmin = await verifyDmGroupAdmin(ctx, from.id, chat.id);
    if (!isAdmin) {
      await ctx.reply(
        "𓆩 Know your place, Sequence 9 worm. Only Council members or group admins can connect this sanctuary to DM. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const botUsername = ctx.me.username;
    const deepLink = `https://t.me/${botUsername}?start=connect_${chat.id}`;
    const keyboard = new InlineKeyboard().url("🔮 Manage Sanctuary in DM", deepLink);

    const msg = [
      formatHeader("DM Sanctuary Link"),
      `Tap the seal below to configure <b>${escapeHtml(chat.title || "this sanctuary")}</b> quietly in private DM without cluttering the chat:`,
      `\n<b>Manual DM Command:</b>\n<code>/connect ${chat.id}</code>`,
      formatDivider(),
      `<i>"Smart admins handle business behind closed doors."</i>`,
    ].join("\n");

    await ctx.reply(msg, {
      parse_mode: "HTML",
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
    return;
  }

  // 2. Inside Private DM
  if (chat.type === "private") {
    const text = ctx.message?.text || "";
    const parts = text.trim().split(/\s+/);
    const arg = parts[1];

    if (!arg) {
      await sendAuthorizedGroupPicker(
        ctx,
        from.id,
        "<i>Select a whitelisted sanctuary to bind to your DM session:</i>"
      );
      return;
    }

    const targetChatId = Number(arg);
    if (Number.isNaN(targetChatId)) {
      await ctx.reply(
        "𓆩 That doesn't even look like a valid Chat ID. Try <code>/connect -1001234567890</code> or just <code>/connect</code>. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const isAdmin = await verifyDmGroupAdmin(ctx, from.id, targetChatId);
    if (!isAdmin) {
      await ctx.reply(
        "𓆩 Nice try, peasant. Either that group isn't whitelisted or you don't hold admin authority there. Sit down. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    await groupRepository.setDmSession(from.id, targetChatId, null);
    const panel = await buildDmControlPanel(ctx, from.id, targetChatId);
    if (!panel.authorized || !panel.text) {
      await ctx.reply("𓆩 Authorization vanished mid-ritual. 𓆪", { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(panel.text, {
      parse_mode: "HTML",
      reply_markup: panel.reply_markup,
    });
  }
}

export async function disconnectCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  if (chat.type !== "private") {
    await ctx.reply(
      "𓆩 Run <code>/disconnect</code> inside our private DM, not in the middle of the group chat. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const existing = await groupRepository.getDmSession(from.id);
  if (!existing) {
    await ctx.reply(
      "𓆩 You weren't even connected to a sanctuary. Disconnecting from nothing is peak Sequence 9 behavior. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  await groupRepository.disconnectDmSession(from.id);
  await ctx.reply(
    "𓆩 DM sanctuary connection severed. Come back when you actually have work to do. 𓆪",
    { parse_mode: "HTML" }
  );
}

export async function sanctuariesCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  if (chat.type !== "private") {
    await ctx.reply(
      "𓆩 Switch sanctuaries from private DM—use <code>/connect</code> here first. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  await sendAuthorizedGroupPicker(ctx, from.id);
}
