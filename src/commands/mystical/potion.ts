import { MyContext } from "../../middlewares/context";
import { userRepository } from "../../database/repositories/user.repository";
import { findPathway } from "./pathway";
import { formatHeader, formatDivider, escapeHtml } from "../../utils/formatters";

export async function potionCommand(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const text = ctx.message?.text || "";
  const parts = text.trim().split(/\s+/);

  let targetPathwayName = parts[1];
  let targetSeqStr = parts[2];

  // If first argument is a number, e.g. /potion 8
  if (targetPathwayName && /^\d$/.test(targetPathwayName)) {
    targetSeqStr = targetPathwayName;
    targetPathwayName = undefined as any;
  }

  let pathway = targetPathwayName ? findPathway(targetPathwayName) : undefined;

  // Fallback to caller's bound pathway or Fool Pathway
  if (!pathway) {
    const dbUser = await userRepository.getUserById(from.id);
    if (dbUser?.pathway) {
      pathway = findPathway(dbUser.pathway);
    }
    if (!pathway) {
      pathway = findPathway("Fool");
    }
  }

  if (!pathway) {
    await ctx.reply("𓆩 Unable to locate potion formula in the archives. 𓆪");
    return;
  }

  const seqLevel = targetSeqStr && /^\d$/.test(targetSeqStr) ? targetSeqStr : "9";
  const seqName = pathway.sequences[seqLevel] || "Initiate";
  const potionGuidance =
    pathway.potion_notes?.[`seq${seqLevel}`] ||
    "Main ingredients and supplementary herbs veiled in ancient hermetic seals. Digest through strict adherence to acting principles.";

  const response = [
    formatHeader(`${pathway.name} — Potion Formula`),
    `<b>Rank:</b> Sequence <b>${seqLevel}</b> — <i>${escapeHtml(seqName)}</i>`,
    `<b>Domain:</b> <i>${escapeHtml(pathway.group)}</i>`,
    formatDivider(),
    `🧪 <b>Potion Formula & Acting Method:</b>\n<i>${escapeHtml(potionGuidance)}</i>`,
    formatDivider(),
    `<i>"Remember that you are merely acting. Never let the potion consume your humanity."</i>`,
  ].join("\n");

  await ctx.reply(response, { parse_mode: "HTML" });
}
