import { MyContext } from "../../middlewares/context";
import { formatHeader, formatDivider } from "../../utils/formatters";

export async function divinationCommand(ctx: MyContext): Promise<void> {
  const role = ctx.memberRole || "BEYONDER";
  const isCouncil =
    role === "CELESTIAL_WORTHY" ||
    role === "THE_FOOL" ||
    role === "THE_WORLD" ||
    role === "THE_STAR";

  const sections: string[] = [
    formatHeader("Astrological Divination Directory"),
    isCouncil
      ? `<i>Even High-Sequence Council members need reminders. Try not to embarrass yourself with a typo.</i>`
      : `<i>Listen up, fragile Sequence 9 worm. Here are the few scraps of magic you're actually allowed to touch without imploding.</i>`,
    formatDivider(),
  ];

  if (isCouncil) {
    sections.push(
      `🏛 <b>Authority & Moderation (Council Only)</b>`,
      ` • <code>/celestial_worthy</code> — Supreme owner dossier and awakening`,
      ` • <code>/council</code> — Tarot Club administrative hierarchy`,
      ` • <code>/ascend</code> — Promote Beyonder to council seat`,
      ` • <code>/degrade</code> — Demote council member to Beyonder`,
      ` • <code>/bestow</code> — Grant or clear custom honorific position`,
      ` • <code>/banish</code> — Permanently sever entity from sanctuary`,
      ` • <code>/exile</code> — Cast entity beyond sanctuary borders`,
      ` • <code>/silence</code> — Mute voice in the Grey Fog`,
      ` • <code>/release</code> — Lift silence from Beyonder`,
      ` • <code>/seal</code> — Seal sanctuary from mundane speech`,
      ` • <code>/unseal</code> — Lift divine silence from chat`,
      ` • <code>/erase</code> — Purge heretical blasphemy and messages`,
      ` • <code>/corrupt</code> — Inflict mark of spiritual corruption (warn)`,
      ` • <code>/purify</code> — Cleanse 1 mark of corruption`,
      ` • <code>/cleanse</code> — Wipe all corruption marks clean`,
      ` • <code>/whisper</code> — Bind Grey Fog keyword/sticker auto-filter`,
      ` • <code>/dispel</code> — Remove an active Grey Fog whisper`,
      ` • <code>/ward</code> — Toggle Spiritual Ward anti-link barrier`,
      ` • <code>/summoning</code> — Preview, toggle, or set welcome rites`,
      ` • <code>/farewell</code> — Preview, toggle, or set departure rites`,
      ""
    );
  }

  sections.push(
    `📜 <b>Information & Board</b>`,
    ` • <code>/divination</code> — This directory (yes, the one you somehow needed help finding)`,
    ` • <code>/sacred_laws</code> — The rules you'll inevitably break anyway`,
    ` • <code>/mysteries</code> — Live overview of sanctuary domain`,
    ` • <code>/fate_records</code> — Activity ledger and who actually carries this chat`,
    ` • <code>/lore</code> — Chronicles and ethos of the Grey Fog`,
    ` • <code>/whispers</code> — List bound keyword triggers in sanctuary`,
    ` • <code>/corruption</code> — Inspect your (probably shameful) corruption marks`,
    "",
    `⚖ <b>Member Participation & Governance</b>`,
    ` • <code>/suggest</code> — Submit feature proposals to the Council`,
    ` • <code>/idea</code> — Propose events or community initiatives`,
    ` • <code>/report</code> — Report bugs or snitch on anomalies`,
    ` • <code>/vote</code> — Cast your tiny, insignificant vote in deliberations`,
    ` • <code>/suggestions</code> — View approved development ledger`,
    "",
    `🔮 <b>Mystical Lore & Progression</b>`,
    ` • <code>/pathway</code> — Inquire or choose from 22 pathways`,
    ` • <code>/sequence</code> — Inquire sequence hierarchy and rank`,
    ` • <code>/potion</code> — Retrieve formulas and acting methods`,
    ` • <code>/tarot</code> — Draw guidance from Major Arcana`,
    ` • <code>/fate</code> — Spirit pendulum fortune and prophecy`,
    ` • <code>/prayer</code> — Grovel before The Fool (+25 XP)`,
    ` • <code>/ritual</code> — Convoke interactive Grey Fog ceremony (+40 XP)`,
    ` • <code>/leaderboard</code> — Top Beyonders by Sequence & XP`,
    ` • <code>/status</code> — Inspect your pathetic Beyonder dossier & XP`,
    formatDivider(),
    isCouncil
      ? `<i>"Wield the Grey Fog with precision, or watch the mortals burn."</i>`
      : `<i>"Stay in your lane, Sequence 9. Touching admin commands won't make you relevant."</i>`
  );

  await ctx.reply(sections.join("\n"), { parse_mode: "HTML" });
}
