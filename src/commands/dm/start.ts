import { MyContext } from "../../middlewares/context";
import { verifyDmGroupAdmin } from "../../middlewares/dm-auth";
import { groupRepository } from "../../database/repositories/group.repository";
import { divinationCommand } from "../board/divination";
import { buildDmControlPanel, sendAuthorizedGroupPicker } from "./panel";
import { formatHeader, formatDivider } from "../../utils/formatters";

export async function startCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  // In groups, keep /start mapped to /divination
  if (chat.type !== "private") {
    await divinationCommand(ctx);
    return;
  }

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const payload = parts[1] || "";

  // 1. Deep-link connect_<chat_id>
  if (payload.startsWith("connect_")) {
    const rawId = payload.slice("connect_".length);
    const targetChatId = Number(rawId);

    if (Number.isNaN(targetChatId)) {
      await ctx.reply(
        "𓆩 Broken deep-link payload. Even copying a link seems hard for you. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const isAdmin = await verifyDmGroupAdmin(ctx, from.id, targetChatId);
    if (!isAdmin) {
      await ctx.reply(
        "𓆩 Denied. Either that group isn't whitelisted or you have zero admin authority there. Stop embarrassing yourself. 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    await groupRepository.setDmSession(from.id, targetChatId, null);
    const panel = await buildDmControlPanel(ctx, from.id, targetChatId);
    if (!panel.authorized || !panel.text) {
      await ctx.reply("𓆩 Authorization failed. 𓆪", { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(panel.text, {
      parse_mode: "HTML",
      reply_markup: panel.reply_markup,
    });
    return;
  }

  // 2. Plain /start in DM
  const intro = [
    formatHeader("Above the Grey Fog — Private DM"),
    `So you actually wandered into my private DMs. If you're a group admin, pick a sanctuary below to configure it quietly without spamming your chat.`,
    `If you're just a regular Beyonder looking for handouts—there are none.`,
    formatDivider(),
    `<b>DM Commands:</b>`,
    ` • <code>/manage</code> — Open active Sanctuary Control Panel`,
    ` • <code>/connect [chat_id]</code> — Bind or switch sanctuaries`,
    ` • <code>/sanctuaries</code> — List all sanctuaries you manage`,
    ` • <code>/disconnect</code> — Sever active DM session`,
    ` • <code>/cancel</code> — Abort any pending input prompt`,
  ].join("\n");

  await sendAuthorizedGroupPicker(ctx, from.id, intro);
}
