import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { defenseRepository } from "../../database/repositories/defense.repository";
import { resolveTargetAndArgs, resolveUserRole } from "../../utils/resolver";
import {
  calculateSequenceLevel,
  getSequenceProgress,
  getSequenceTierLabel,
  getSequenceTitle,
} from "../../utils/sequences";
import {
  formatHeader,
  formatDivider,
  formatUserMention,
  formatRoleBadge,
  escapeHtml,
} from "../../utils/formatters";

export async function statusCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const { target } = await resolveTargetAndArgs(ctx);
  const targetId = target ? target.userId : from.id;
  const targetName = target ? target.firstName || "Beyonder" : from.first_name;
  const targetUsername = target ? target.username : from.username;

  const member = await userRepository.getMember(chat.id, targetId);
  const effectiveRole = await resolveUserRole(ctx, targetId);
  const corruptions = await defenseRepository.getCorruptions(chat.id, targetId);
  const wardConfig = await defenseRepository.getWardConfig(chat.id);

  const xp = Number(member?.spirituality_xp ?? 0);
  const seqLevel = calculateSequenceLevel(xp);
  const seqTitle = getSequenceTitle(member?.pathway, seqLevel);
  const tierLabel = getSequenceTierLabel(seqLevel);
  const progress = getSequenceProgress(xp, seqLevel);

  const pathwayText = member?.pathway ? escapeHtml(member.pathway) : "<i>Unaligned Mortal</i>";
  const customPosText = member?.custom_position
    ? `<b>Honorific Position:</b> <i>${escapeHtml(member.custom_position)}</i>\n`
    : "";

  const xpLine =
    progress.nextThreshold !== null
      ? `<b>Spirituality XP:</b> <code>${xp} / ${progress.nextThreshold}</code> (${progress.percent}% toward Seq ${progress.nextLevel})\n<code>[${progress.progressBar}]</code>`
      : `<b>Spirituality XP:</b> <code>${xp}</code> (Apex of Sequence 0)\n<code>[${progress.progressBar}]</code>`;

  const response = [
    formatHeader("Beyonder Spiritual Dossier"),
    `<b>Identity:</b> ${formatUserMention(targetId, targetName, targetUsername)} (<code>${targetId}</code>)`,
    `<b>Council Seat:</b> ${formatRoleBadge(effectiveRole)}`,
    `${customPosText}<b>Chosen Pathway:</b> ${pathwayText}`,
    `<b>Sequence Rank:</b> ${escapeHtml(seqTitle)} (<i>${escapeHtml(tierLabel)}</i>)`,
    formatDivider(),
    xpLine,
    formatDivider(),
    `🕯 <b>Prayers Offered:</b> <code>${member?.prayers_count ?? 0}</code>`,
    `💬 <b>Messages Inscribed:</b> <code>${member?.messages_count ?? 0}</code>`,
    `☠️ <b>Corruption Marks:</b> <code>[${corruptions.length}/${wardConfig.warn_limit}]</code>`,
    formatDivider(),
    `<i>"Act according to your Sequence name to digest the potion."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
