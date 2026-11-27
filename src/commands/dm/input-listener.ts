import { NextFunction } from "grammy";
import { MyContext } from "../../middlewares/context";
import { verifyDmGroupAdmin } from "../../middlewares/dm-auth";
import { groupRepository } from "../../database/repositories/group.repository";
import { defenseRepository, WhisperResponseType } from "../../database/repositories/defense.repository";
import { parseTriggerAndRest } from "../authority/whisper";
import { buildDmControlPanel } from "./panel";
import { escapeHtml } from "../../utils/formatters";

export async function cancelCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  if (chat.type !== "private") return;

  const session = await groupRepository.getDmSession(from.id);
  if (!session || !session.pending_input) {
    await ctx.reply(
      "𓆩 Nothing was pending. Canceling thin air won't make you productive. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  await groupRepository.setDmPendingInput(from.id, null);
  await ctx.reply(
    "𓆩 Pending prompt aborted. Try making up your mind next time. 𓆪",
    { parse_mode: "HTML" }
  );
}

export async function dmInputListenerMiddleware(
  ctx: MyContext,
  next: NextFunction
): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  const msg = ctx.message;

  if (!chat || chat.type !== "private" || !from || from.is_bot || !msg) {
    return next();
  }

  const text = msg.text || "";
  // Let slash commands pass through to command handlers
  if (text.trim().startsWith("/")) {
    return next();
  }

  const session = await groupRepository.getDmSession(from.id);
  if (!session || !session.pending_input) {
    return next();
  }

  const chatId = session.active_chat_id;
  const isAdmin = await verifyDmGroupAdmin(ctx, from.id, chatId);
  if (!isAdmin) {
    await groupRepository.disconnectDmSession(from.id);
    await ctx.reply(
      "𓆩 Your admin privileges in that sanctuary expired. Stop wasting my time and crawl back to the group. 𓆪",
      { parse_mode: "HTML" }
    );
    return;
  }

  const pending = session.pending_input;
  let statusNotice = "";

  switch (pending) {
    case "WELCOME_TEXT": {
      if (!text.trim()) {
        await ctx.reply("𓆩 Send actual text for the Welcome template, or /cancel. 𓆪", {
          parse_mode: "HTML",
        });
        return;
      }
      await groupRepository.setWelcomeTemplate(chatId, text.trim());
      statusNotice = "✅ Welcome template updated for your sanctuary.";
      break;
    }

    case "GOODBYE_TEXT": {
      if (!text.trim()) {
        await ctx.reply("𓆩 Send actual text for the Goodbye template, or /cancel. 𓆪", {
          parse_mode: "HTML",
        });
        return;
      }
      await groupRepository.setGoodbyeTemplate(chatId, text.trim());
      statusNotice = "✅ Goodbye template updated for your sanctuary.";
      break;
    }

    case "BAN_DECREE":
    case "MUTE_DECREE": {
      if (!text.trim()) {
        await ctx.reply("𓆩 Send a valid decree template or <code>reset</code>, or /cancel. 𓆪", {
          parse_mode: "HTML",
        });
        return;
      }
      const type = pending === "BAN_DECREE" ? "ban" : "mute";
      if (text.trim().toLowerCase() === "reset") {
        await groupRepository.setModTemplate(chatId, type, null);
        statusNotice = `🔄 ${type.toUpperCase()} decree reset back to the default roast.`;
      } else {
        await groupRepository.setModTemplate(chatId, type, text.trim());
        statusNotice = `✅ Custom ${type.toUpperCase()} decree saved.`;
      }
      break;
    }

    case "WARD_ALLOW": {
      const domain = text.trim().split(/\s+/)[0];
      if (!domain) {
        await ctx.reply("𓆩 Send a valid domain name (e.g. <code>youtube.com</code>), or /cancel. 𓆪", {
          parse_mode: "HTML",
        });
        return;
      }
      await defenseRepository.addWardDomain(chatId, domain);
      statusNotice = `✅ Whitelisted <code>${escapeHtml(domain.toLowerCase())}</code> in Spiritual Ward.`;
      break;
    }

    case "WARD_DISALLOW": {
      const domain = text.trim().split(/\s+/)[0];
      if (!domain) {
        await ctx.reply("𓆩 Send the domain you want to disallow, or /cancel. 𓆪", {
          parse_mode: "HTML",
        });
        return;
      }
      await defenseRepository.removeWardDomain(chatId, domain);
      statusNotice = `🚫 Removed <code>${escapeHtml(domain.toLowerCase())}</code> from Spiritual Ward whitelist.`;
      break;
    }

    case "WHISPER_ADD": {
      let responseType: WhisperResponseType = "TEXT";
      let fileId: string | null = null;
      let textContent: string | null = null;
      let trigger = "";

      const reply = msg.reply_to_message;
      if (msg.animation && msg.caption) {
        const parsed = parseTriggerAndRest(msg.caption);
        if (parsed) {
          trigger = parsed.trigger;
          responseType = "ANIMATION";
          fileId = msg.animation.file_id;
          textContent = parsed.rest || null;
        }
      } else if (msg.photo && msg.photo.length > 0 && msg.caption) {
        const parsed = parseTriggerAndRest(msg.caption);
        if (parsed) {
          trigger = parsed.trigger;
          responseType = "PHOTO";
          fileId = msg.photo[msg.photo.length - 1].file_id;
          textContent = parsed.rest || null;
        }
      } else if (text.trim() && reply?.sticker) {
        const parsed = parseTriggerAndRest(text);
        if (parsed) {
          trigger = parsed.trigger;
          responseType = "STICKER";
          fileId = reply.sticker.file_id;
          textContent = parsed.rest || null;
        }
      } else if (text.trim() && reply?.animation) {
        const parsed = parseTriggerAndRest(text);
        if (parsed) {
          trigger = parsed.trigger;
          responseType = "ANIMATION";
          fileId = reply.animation.file_id;
          textContent = parsed.rest || reply.caption || null;
        }
      } else if (text.trim() && reply?.photo && reply.photo.length > 0) {
        const parsed = parseTriggerAndRest(text);
        if (parsed) {
          trigger = parsed.trigger;
          responseType = "PHOTO";
          fileId = reply.photo[reply.photo.length - 1].file_id;
          textContent = parsed.rest || reply.caption || null;
        }
      } else if (text.trim()) {
        const parsed = parseTriggerAndRest(text);
        if (parsed && parsed.rest) {
          trigger = parsed.trigger;
          responseType = "TEXT";
          textContent = parsed.rest;
        }
      }

      if (!trigger) {
        await ctx.reply(
          '𓆩 Invalid whisper format. Send <code>&lt;trigger&gt; &lt;reply&gt;</code>, a GIF/Photo with caption <code>&lt;trigger&gt;</code>, or reply to a Sticker with <code>&lt;trigger&gt;</code>. Or /cancel. 𓆪',
          { parse_mode: "HTML" }
        );
        return;
      }

      await defenseRepository.setWhisper(chatId, trigger, responseType, textContent, fileId, from.id);
      statusNotice = `👻 Bound whisper <code>${escapeHtml(trigger)}</code> [<code>${responseType}</code>].`;
      break;
    }

    case "WHISPER_DEL": {
      let trigger = text.trim();
      if (
        (trigger.startsWith('"') && trigger.endsWith('"')) ||
        (trigger.startsWith("'") && trigger.endsWith("'"))
      ) {
        trigger = trigger.slice(1, -1).trim();
      }
      if (!trigger) {
        await ctx.reply("𓆩 Send the trigger keyword to dispel, or /cancel. 𓆪", {
          parse_mode: "HTML",
        });
        return;
      }
      const removed = await defenseRepository.removeWhisper(chatId, trigger);
      statusNotice = removed
        ? `💨 Dispelled whisper <code>${escapeHtml(trigger.toLowerCase())}</code>.`
        : `𓆩 No active whisper found for <code>${escapeHtml(trigger.toLowerCase())}</code>. 𓆪`;
      break;
    }

    default:
      await groupRepository.setDmPendingInput(from.id, null);
      return next();
  }

  await groupRepository.setDmPendingInput(from.id, null);
  await ctx.reply(statusNotice, { parse_mode: "HTML" });

  const panel = await buildDmControlPanel(ctx, from.id, chatId);
  if (panel.authorized && panel.text) {
    await ctx.reply(panel.text, {
      parse_mode: "HTML",
      reply_markup: panel.reply_markup,
    });
  }
}
