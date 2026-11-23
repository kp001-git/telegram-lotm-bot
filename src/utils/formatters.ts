/**
 * HTML Formatting and LOTM-themed styling utilities.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatHeader(title: string): string {
  return `<b>𓆩 ${escapeHtml(title.toUpperCase())} 𓆪</b>\n`;
}

export function formatDivider(): string {
  return `\n<code>──────────────────────────</code>\n`;
}

export function formatUserMention(userId: number, firstName: string, username?: string | null): string {
  const safeName = escapeHtml(firstName || "Unknown Beyonder");
  if (username) {
    return `<a href="tg://user?id=${userId}">${safeName}</a> (@${escapeHtml(username)})`;
  }
  return `<a href="tg://user?id=${userId}">${safeName}</a>`;
}

export function formatRoleBadge(role: string): string {
  switch (role) {
    case "CELESTIAL_WORTHY":
      return "👑 <b>Celestial Worthy</b>";
    case "THE_FOOL":
      return "🃏 <b>The Fool</b>";
    case "THE_WORLD":
      return "🗡 <b>The World</b>";
    case "THE_STAR":
      return "✨ <b>The Star</b>";
    case "BEYONDER":
    default:
      return "🕯 <b>Beyonder</b>";
  }
}
