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

  if (!subcommand) {
    const wardConfig = await defenseRepository.getWardConfig(chat.id);
    const statusBadge = wardConfig.ward_enabled === 1 ? "🛡 <b>ACTIVE</b>" : "⭕ <b>DORMANT</b>";
    const domains = wardConfig.ward_whitelist.map((d) => `<code>${escapeHtml(d)}</code>`).join(", ");

    const statusMsg = [
      formatHeader("Spiritual Ward Barrier"),
      `<b>Status:</b> ${statusBadge}`,
      `<b>Trusted Domains:</b> ${domains}`,
      formatDivider(),
      `<b>Commands:</b>`,
      ` • <code>/ward on</code> — Raise anti-link barrier`,
      ` • <code>/ward off</code> — Lower anti-link barrier`,
      ` • <code>/ward allow &lt;domain&gt;</code> — Whitelist a trusted domain`,
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
        `🛡 An invisible barrier of Grey Fog now surrounds this sanctuary.`,
        `<i>Unauthorized external links and invites sent by non-Council Beyonders will be erased immediately.</i>`,
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
        `⭕ The anti-link barrier has receded into the mist.`,
        `<i>External links are once again permitted in this sanctuary.</i>`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "allow") {
    const domainInput = parts[2];
    if (!domainInput) {
      await ctx.reply(
        "𓆩 Specify a domain to trust:\n<code>/ward allow youtube.com</code> 𓆪",
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
        `✅ Trusted domain added to the Spiritual Ward.`,
        `\n<b>Trusted Domains:</b> ${domains}`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  await ctx.reply(
    "𓆩 Invalid ward directive. Use <code>/ward on</code>, <code>/ward off</code>, or <code>/ward allow &lt;domain&gt;</code>. 𓆪",
    { parse_mode: "HTML" }
  );
}
