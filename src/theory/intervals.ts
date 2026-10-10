import { type Note, LETTER_PC, mod } from './notes';

/**
 * An interval is a diatonic number (1 = unison, 3 = third, 9 = ninth...)
 * plus a size in semitones. Both are needed: a ♯4 and a ♭5 are both six
 * semitones but land on different letters.
 */
export interface Interval {
  degree: number;
  semitones: number;
}

/** Semitones of each degree in the major scale, extended to 13. */
const MAJOR_SEMIS: Record<number, number> = {
  1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11,
  8: 12, 9: 14, 10: 16, 11: 17, 12: 19, 13: 21,
};

export const iv = (degree: number, semitones: number): Interval => ({ degree, semitones });

/**
 * Build an interval list from formula tokens like "1 b3 5 b7" or "1 #4".
 * Accidentals are relative to the major scale, which is how players
 * usually write formulas.
 */
export function formula(tokens: string): Interval[] {
  return tokens.trim().split(/\s+/).map((tok) => {
    const m = /^(bb|b|##|#)?(\d+)$/.exec(tok);
    if (!m) throw new Error(`Bad formula token "${tok}"`);
    const degree = Number(m[2]);
    const acc = m[1] ? (m[1].startsWith('#') ? m[1].length : -m[1].length) : 0;
    return { degree, semitones: MAJOR_SEMIS[degree] + acc };
  });
}

/** Label an interval relative to major: "1", "♭3", "♯4", "𝄫7". */
export function intervalLabel(i: Interval): string {
  const diff = i.semitones - MAJOR_SEMIS[i.degree];
  const prefix = diff === 0 ? '' : diff === -1 ? '♭' : diff === -2 ? '𝄫' : diff === 1 ? '♯' : diff === 2 ? '𝄪' : `(${diff})`;
  return prefix + i.degree;
}

const QUALITY_NAMES: Record<string, string> = {
  '1:0': 'Unison', '2:1': 'Minor 2nd', '2:2': 'Major 2nd', '2:3': 'Augmented 2nd',
  '3:3': 'Minor 3rd', '3:4': 'Major 3rd', '4:5': 'Perfect 4th', '4:6': 'Augmented 4th',
  '5:6': 'Diminished 5th', '5:7': 'Perfect 5th', '5:8': 'Augmented 5th',
  '6:8': 'Minor 6th', '6:9': 'Major 6th', '7:9': 'Diminished 7th', '7:10': 'Minor 7th',
  '7:11': 'Major 7th', '9:13': 'Minor 9th', '9:14': 'Major 9th', '9:15': 'Augmented 9th',
  '11:17': 'Perfect 11th', '11:18': 'Augmented 11th', '13:20': 'Minor 13th', '13:21': 'Major 13th',
};

export function intervalName(i: Interval): string {
  return QUALITY_NAMES[`${i.degree}:${i.semitones}`] ?? intervalLabel(i);
}

/** Transpose a note up by an interval, keeping the correct letter. */
export function transpose(root: Note, i: Interval): Note {
  const letter = mod(root.letter + i.degree - 1, 7);
  const target = LETTER_PC[root.letter] + root.acc + i.semitones;
  let acc = mod(target - LETTER_PC[letter], 12);
  if (acc > 6) acc -= 12;
  return { letter, acc };
}

/** The interval from `root` up to `other` (within an octave). */
export function between(root: Note, other: Note): Interval {
  const degree = mod(other.letter - root.letter, 7) + 1;
  const semitones = mod(LETTER_PC[other.letter] + other.acc - (LETTER_PC[root.letter] + root.acc), 12);
  return { degree, semitones };
}
