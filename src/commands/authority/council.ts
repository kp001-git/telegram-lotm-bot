import { MyContext } from "../../middlewares/context";
import { userRepository, DbUser } from "../../database/repositories/user.repository";
import { formatHeader, formatDivider, formatUserMention } from "../../utils/formatters";

export async function councilCommand(ctx: MyContext): Promise<void> {
  const councilMembers = await userRepository.getCouncilMembers();

  // Group members by role
  const groups: Record<string, DbUser[]> = {
    CELESTIAL_WORTHY: [],
    THE_FOOL: [],
    THE_WORLD: [],
    THE_STAR: [],
  };

  for (const member of councilMembers) {
    if (groups[member.role]) {
      groups[member.role].push(member);
    }
  }

  const sections: string[] = [formatHeader("Tarot Club Divine Council")];
  sections.push(
    `<i>The supreme administration seated at the long bronze table above the gray fog.</i>\n`
  );

  // 1. Celestial Worthy
  sections.push(`👑 <b>The Celestial Worthy</b> (Supreme Owner)`);
  sections.push(`<i>Responsibility: Primordial authority, final judgment, divine decrees.</i>`);
  if (groups.CELESTIAL_WORTHY.length > 0) {
    sections.push(
      groups.CELESTIAL_WORTHY
        .map((m) => ` • ${formatUserMention(m.user_id, m.first_name, m.username)} [Active]`)
        .join("\n")
    );
  } else {
    sections.push(` • <i>Throne currently awaiting awakening</i>`);
  }
  sections.push("");

  // 2. The Fool
  sections.push(`🃏 <b>The Fool</b> (Co-Owner & Deputy)`);
  sections.push(`<i>Responsibility: Custodian of the fog, ritual blessings, divine guidance.</i>`);
  if (groups.THE_FOOL.length > 0) {
    sections.push(
      groups.THE_FOOL
        .map((m) => ` • ${formatUserMention(m.user_id, m.first_name, m.username)} [Active]`)
        .join("\n")
    );
  } else {
    sections.push(` • <i>Seat currently unoccupied</i>`);
  }
  sections.push("");

  // 3. The World
  sections.push(`🗡 <b>The World</b> (Senior Administrators)`);
  sections.push(`<i>Responsibility: Enforcement of sacred laws, cleansing heresy, group order.</i>`);
  if (groups.THE_WORLD.length > 0) {
    sections.push(
      groups.THE_WORLD
        .map((m) => ` • ${formatUserMention(m.user_id, m.first_name, m.username)} [Active]`)
        .join("\n")
    );
  } else {
    sections.push(` • <i>Native administrators operate under The World</i>`);
  }
  sections.push("");

  // 4. The Star
  sections.push(`✨ <b>The Star</b> (Council Moderators)`);
  sections.push(`<i>Responsibility: Member surveillance, poetic mediation, petition triage.</i>`);
  if (groups.THE_STAR.length > 0) {
    sections.push(
      groups.THE_STAR
        .map((m) => ` • ${formatUserMention(m.user_id, m.first_name, m.username)} [Active]`)
        .join("\n")
    );
  } else {
    sections.push(` • <i>Seat currently unoccupied</i>`);
  }

  sections.push(formatDivider());
  sections.push(`<i>All authority is verified through the libSQL persistent ledger.</i>`);

  await ctx.reply(sections.join("\n"), { parse_mode: "HTML" });
}
