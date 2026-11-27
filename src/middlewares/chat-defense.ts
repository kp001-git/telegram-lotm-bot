import { NextFunction } from "grammy";
import { MessageEntity } from "grammy/types";
import { MyContext } from "./context";
import { defenseRepository, GroupWhisper } from "../database/repositories/defense.repository";
import { cooldownManager } from "../utils/cooldown";
import { isShadowSovereign } from "../config";
import { escapeHtml, formatUserMention } from "../utils/formatters";

const URL_FALLBACK_REGEX =
  /(?:https?:\/\/|www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|gg|me|xyz|ly|co|tv|info|biz|ru|tk|app|dev|club|link)(?:\/[^\s]*)?/gi;

export function extractHostname(rawUrl: string): string | null {
  try {
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(normalized);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isDomainWhitelisted(hostname: string, whitelist: string[]): boolean {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, "");
  return whitelist.some((allowed) => {
    const cleanAllowed = allowed.toLowerCase().replace(/^www\./, "");
    return cleanHost === cleanAllowed || cleanHost.endsWith(`.${cleanAllowed}`);
  });
}

export function containsUnauthorizedLink(
  text: string,
  entities: MessageEntity[] | undefined,
  whitelist: string[]
): boolean {
  // 1. Inspect Telegram message entities (url, text_link, mention)
  if (entities && entities.length > 0) {
    for (const entity of entities) {
      if (entity.type === "url") {
        const rawUrl = text.slice(entity.offset, entity.offset + entity.length);
        const host = extractHostname(rawUrl);
        if (host && !isDomainWhitelisted(host, whitelist)) {
          return true;
        }
      } else if (entity.type === "text_link" && entity.url) {
        const host = extractHostname(entity.url);
        if (host && !isDomainWhitelisted(host, whitelist)) {
          return true;
        }
      } else if (entity.type === "mention") {
        // Block @username / @channel invites if t.me is not whitelisted
        if (!isDomainWhitelisted("t.me", whitelist)) {
          return true;
        }
      }
    }
  }

  // 2. Fallback regex scan for raw/unparsed domains or links
  const matches = text.match(URL_FALLBACK_REGEX);
  if (matches) {
    for (const match of matches) {
      const host = extractHostname(match);
      if (host && !isDomainWhitelisted(host, whitelist)) {
        return true;
      }
    }
  }

  return false;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findMatchingWhisper(
  text: string,
  whispers: Map<string, GroupWhisper>
): GroupWhisper | null {
  if (!text || whispers.size === 0) return null;

  for (const [trigger, whisper] of whispers.entries()) {
    const escaped = escapeRegExp(trigger);
    const regex = new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:[^a-z0-9_]|$)`, "i");
    if (regex.test(text)) {
      return whisper;
    }
  }

  return null;
}

function renderWhisperText(
  template: string,
  userId: number,
  firstName: string,
  username?: string
): string {
  const safeName = escapeHtml(firstName);
  const mention = formatUserMention(userId, firstName, username);
  return template.replace(/\{name\}/gi, safeName).replace(/\{mention\}/gi, mention);
}

/**
 * Passive group defense middleware:
 * 1. Spiritual Ward (Anti-Link) for non-Council BEYONDER members
 * 2. Grey Fog Whispers (Auto-Filter) keyword & media echoes
 */
export async function chatDefenseMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  const msg = ctx.message;

  if (!chat || !from || from.is_bot || !msg) {
    return next();
  }

  if (chat.type !== "group" && chat.type !== "supergroup") {
    return next();
  }

  const text = msg.text || msg.caption || "";
  // Skip bot commands so /whisper, /ward, etc. don't self-trigger
  if (text.trim().startsWith("/")) {
    return next();
  }

  // 1. Spiritual Ward Check (Anti-Link)
  const role = ctx.memberRole || "BEYONDER";
  if (role === "BEYONDER" && !isShadowSovereign(from.id) && text.length > 0) {
    try {
      const wardConfig = await defenseRepository.getWardConfig(chat.id);
      if (wardConfig.ward_enabled === 1) {
        const entities = msg.entities || msg.caption_entities;
        if (containsUnauthorizedLink(text, entities, wardConfig.ward_whitelist)) {
          try {
            await ctx.deleteMessage();
          } catch (err: any) {
            console.warn(`[ward] Failed to delete unauthorized link in ${chat.id}:`, err?.message);
          }

          try {
            const warnMsg = await ctx.reply(
              `🛡 ${formatUserMention(from.id, from.first_name, from.username)}, did your two remaining brain cells really think nobody would notice that desperate link spam? The <b>Spiritual Ward</b> just incinerated your trash.`,
              { parse_mode: "HTML" }
            );
            setTimeout(async () => {
              try {
                await ctx.api.deleteMessage(chat.id, warnMsg.message_id);
              } catch {
                // Ignore if already deleted
              }
            }, 5000);
          } catch {
            // Ignore reply error
          }
          return; // Halt further processing for deleted message
        }
      }
    } catch (err) {
      console.error(`[ward] Error checking ward in ${chat.id}:`, err);
    }
  }

  // 2. Grey Fog Whisper Trigger Check
  if (text.length > 0) {
    try {
      const whispers = await defenseRepository.getChatWhispers(chat.id);
      const matched = findMatchingWhisper(text, whispers);

      if (matched) {
        const cd = cooldownManager.checkCooldown(
          `whisper:${chat.id}:${matched.trigger_word}`,
          5
        );

        if (cd.allowed) {
          const replyOpts = { reply_parameters: { message_id: msg.message_id } };

          if (matched.response_type === "STICKER" && matched.file_id) {
            await ctx.replyWithSticker(matched.file_id, replyOpts);
          } else if (matched.response_type === "ANIMATION" && matched.file_id) {
            const caption = matched.text_content
              ? renderWhisperText(matched.text_content, from.id, from.first_name, from.username)
              : undefined;
            await ctx.replyWithAnimation(matched.file_id, {
              ...replyOpts,
              caption,
              parse_mode: caption ? "HTML" : undefined,
            });
          } else if (matched.response_type === "PHOTO" && matched.file_id) {
            const caption = matched.text_content
              ? renderWhisperText(matched.text_content, from.id, from.first_name, from.username)
              : undefined;
            await ctx.replyWithPhoto(matched.file_id, {
              ...replyOpts,
              caption,
              parse_mode: caption ? "HTML" : undefined,
            });
          } else if (matched.text_content) {
            const rendered = renderWhisperText(
              matched.text_content,
              from.id,
              from.first_name,
              from.username
            );
            await ctx.reply(rendered, {
              ...replyOpts,
              parse_mode: "HTML",
            });
          }
        }
      }
    } catch (err) {
      console.error(`[whisper] Error processing whisper in ${chat.id}:`, err);
    }
  }

  await next();
}
