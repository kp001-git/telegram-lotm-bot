import { MyContext } from "../../middlewares/context";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { auditRepository } from "../../database/repositories/audit.repository";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function wardCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);
  const subcommand = parts[1]?.toLowerCase();

  if (!subcommand || subcommand === "list") {
    const wardConfig = await defenseRepository.getWardConfig(chat.id);
    const statusBadge = wardConfig.ward_enabled === 1 ? "🛡 <b>ACTIVE</b>" : "⭕ <b>INACTIVE</b>";
    const domains =
      wardConfig.ward_whitelist.length > 0
        ? wardConfig.ward_whitelist.map((d) => ` • <code>${escapeHtml(d)}</code>`).join("\n")
        : " • <i>None (every external link gets incinerated on sight)</i>";

    const statusMsg = [
      formatHeader("Spiritual Ward Barrier"),
      `<b>Status:</b> ${statusBadge}`,
      `\n<b>Whitelisted Domains (${wardConfig.ward_whitelist.length}):</b>\n${domains}`,
      formatDivider(),
      `<b>Directives:</b>`,
      ` • <code>/ward on</code> — Raise the anti-link barrier`,
      ` • <code>/ward off</code> — Lower the anti-link barrier`,
      ` • <code>/ward allow &lt;domain&gt;</code> — Whitelist a trusted domain`,
      ` • <code>/ward disallow &lt;domain&gt;</code> — Revoke a domain's pass`,
      ` • <code>/ward list</code> — Inspect current ward &amp; whitelist`,
      formatDivider(),
      `<i>"If you can't manage a 5-word command syntax, maybe let another admin handle security."</i>`,
    ].join("\n");

    await ctx.reply(statusMsg, { parse_mode: "HTML" });
    return;
  }

  if (subcommand === "on") {
    await defenseRepository.setWardEnabled(chat.id, true);
    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      action: "WARD_ON",
      reason: "Activated Spiritual Ward anti-link barrier",
    });

    await ctx.reply(
      [
        formatHeader("Spiritual Ward Raised"),
        `🛡 The Spiritual Ward is now <b>ACTIVE</b>. Any desperate Sequence 9 peasant dropping unauthorized links will have their garbage deleted on sight.`,
        `<i>Spam elsewhere—this sanctuary isn't your personal billboard.</i>`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "off") {
    await defenseRepository.setWardEnabled(chat.id, false);
    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      action: "WARD_OFF",
      reason: "Lowered Spiritual Ward anti-link barrier",
    });

    await ctx.reply(
      [
        formatHeader("Spiritual Ward Lowered"),
        `⭕ The Spiritual Ward is now <b>INACTIVE</b>. You lowered the shields—don't come crying to me when bots flood the chat with garbage links.`,
        `<i>External links are temporarily unpoliced.</i>`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "allow") {
    const domainInput = parts[2];
    if (!domainInput) {
      await ctx.reply(
        "𓆩 Give me an actual domain to whitelist, genius:\n<code>/ward allow youtube.com</code> 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const updated = await defenseRepository.addWardDomain(chat.id, domainInput);
    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      action: "WARD_ALLOW",
      reason: `Whitelisted domain: ${domainInput.toLowerCase()}`,
    });

    const domains = updated.map((d) => `<code>${escapeHtml(d)}</code>`).join(", ");
    await ctx.reply(
      [
        formatHeader("Ward Whitelist Updated"),
        `✅ Fine, <code>${escapeHtml(domainInput.toLowerCase())}</code> gets a pass through the Spiritual Ward. Try not to regret trusting it.`,
        `\n<b>Whitelisted Domains:</b> ${domains}`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "disallow" || subcommand === "remove" || subcommand === "deny") {
    const domainInput = parts[2];
    if (!domainInput) {
      await ctx.reply(
        "𓆩 What domain am I supposed to blacklist, genius? Try:\n<code>/ward disallow youtube.com</code> 𓆪",
        { parse_mode: "HTML" }
      );
      return;
    }

    const updated = await defenseRepository.removeWardDomain(chat.id, domainInput);
    await auditRepository.logAndMirror(ctx.api, {
      chat_id: chat.id,
      actor_id: from.id,
      action: "WARD_DISALLOW",
      reason: `Removed domain from whitelist: ${domainInput.toLowerCase()}`,
    });

    const domains =
      updated.length > 0
        ? updated.map((d) => `<code>${escapeHtml(d)}</code>`).join(", ")
        : "<i>None (total lockdown)</i>";

    await ctx.reply(
      [
        formatHeader("Ward Privilege Revoked"),
        `🚫 <code>${escapeHtml(domainInput.toLowerCase())}</code> has been kicked off the whitelist. Drop that link now and watch it get vaporized.`,
        `\n<b>Remaining Allowed Domains:</b> ${domains}`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  await ctx.reply(
    "𓆩 Invalid directive. Did you even read <code>/ward list</code>? Valid options: <code>on</code>, <code>off</code>, <code>allow &lt;domain&gt;</code>, <code>disallow &lt;domain&gt;</code>, or <code>list</code>. 𓆪",
    { parse_mode: "HTML" }
  );
}
