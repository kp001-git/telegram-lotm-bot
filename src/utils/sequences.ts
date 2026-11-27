import pathwaysData from "../data/pathways.json";

export const SEQUENCE_XP_THRESHOLDS: Record<number, number> = {
  9: 0,
  8: 100,
  7: 300,
  6: 600,
  5: 1100,
  4: 1800,
  3: 2800,
  2: 4200,
  1: 6000,
  0: 9000,
};

interface PathwayEntry {
  name: string;
  sequences: Record<string, string>;
}

/**
 * Calculates Sequence level (9 down to 0) from accumulated Spirituality XP.
 */
export function calculateSequenceLevel(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  for (let level = 0; level <= 9; level++) {
    if (safeXp >= SEQUENCE_XP_THRESHOLDS[level]) {
      return level;
    }
  }
  return 9;
}

/**
 * Returns the canonical LOTM Sequence title for a pathway and sequence level,
 * or "Sequence <level> Beyonder" if no pathway is bound.
 */
export function getSequenceTitle(pathwayName: string | null | undefined, level: number): string {
  const clamped = Math.max(0, Math.min(9, level));

  if (pathwayName && pathwayName.trim().length > 0) {
    const clean = pathwayName.trim().toLowerCase().replace(/pathway$/, "").trim();
    const matched = (pathwaysData as PathwayEntry[]).find((p) => {
      const pName = p.name.toLowerCase().replace(/pathway$/, "").trim();
      return pName === clean || pName.includes(clean) || clean.includes(pName);
    });

    const seqName = matched?.sequences?.[String(clamped)];
    if (seqName) {
      return `Sequence ${clamped}: ${seqName}`;
    }
  }

  return `Sequence ${clamped} Beyonder`;
}

/**
 * Returns the mystical tier label for a given sequence level.
 */
export function getSequenceTierLabel(level: number): string {
  if (level <= 0) return "True Deity";
  if (level <= 2) return "Angel";
  if (level <= 4) return "Saint / Demigod";
  if (level <= 7) return "Mid-Sequence";
  return "Low-Sequence";
}

/**
 * Builds an ASCII progress bar and next-sequence advancement metrics.
 */
export function getSequenceProgress(xp: number, level: number): {
  nextLevel: number | null;
  currentThreshold: number;
  nextThreshold: number | null;
  percent: number;
  progressBar: string;
} {
  const clamped = Math.max(0, Math.min(9, level));
  const currentThreshold = SEQUENCE_XP_THRESHOLDS[clamped];

  if (clamped === 0) {
    return {
      nextLevel: null,
      currentThreshold,
      nextThreshold: null,
      percent: 100,
      progressBar: "██████████",
    };
  }

  const nextLevel = clamped - 1;
  const nextThreshold = SEQUENCE_XP_THRESHOLDS[nextLevel];
  const span = Math.max(1, nextThreshold - currentThreshold);
  const gained = Math.max(0, xp - currentThreshold);
  const percent = Math.min(100, Math.floor((gained / span) * 100));
  const filled = Math.round((percent / 100) * 10);
  const progressBar = "█".repeat(filled) + "░".repeat(10 - filled);

  return {
    nextLevel,
    currentThreshold,
    nextThreshold,
    percent,
    progressBar,
  };
}
