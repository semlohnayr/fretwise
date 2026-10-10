/**
 * Core pitch model.
 *
 * A note is a letter (C..B) plus an accidental offset. Keeping the letter
 * separate from the pitch class is what lets us spell things correctly:
 * F♯ major contains E♯ (not F), and C°7 contains B𝄫 (not A).
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

/** Pitch class of each natural letter (C = 0). */
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const;

export interface Note {
  /** Index into LETTERS (0 = C ... 6 = B). */
  letter: number;
  /** Accidental: -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp. */
  acc: number;
}

/** Positive modulo. */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function pc(note: Note): number {
  return mod(LETTER_PC[note.letter] + note.acc, 12);
}

const ACC_UNICODE: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };
const ACC_ASCII: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** Display name, e.g. "F♯", "B♭", "E𝄫". */
export function noteName(note: Note, ascii = false): string {
  const table = ascii ? ACC_ASCII : ACC_UNICODE;
  const acc = table[note.acc] ?? (note.acc > 0 ? '#'.repeat(note.acc) : 'b'.repeat(-note.acc));
  return LETTERS[note.letter] + acc;
}

/** Parse "C", "F#", "Bb", "F♯", "B♭", "Ebb", "C##". */
export function parseNote(input: string): Note {
  const s = input.trim().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/𝄫/g, 'bb').replace(/𝄪/g, '##');
  const m = /^([A-Ga-g])(#{0,2}|b{0,2})$/.exec(s);
  if (!m) throw new Error(`Cannot parse note "${input}"`);
  const letter = LETTERS.indexOf(m[1].toUpperCase() as Letter);
  const accStr = m[2];
  const acc = accStr.startsWith('#') ? accStr.length : accStr.length ? -accStr.length : 0;
  return { letter, acc };
}

export const n = parseNote;

export function sameNote(a: Note, b: Note): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}

/**
 * Preferred spelling of a bare pitch class when we have no key context
 * (e.g. labelling every fret on the neck).
 */
export function spellPc(p: number, preferFlats = false): Note {
  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  return parseNote((preferFlats ? flats : sharps)[mod(p, 12)]);
}

/**
 * The twelve roots offered in pickers, spelled the way musicians usually
 * name keys (no D♯ major, no G♭ for the sharp side etc).
 */
export const ROOT_CHOICES: Note[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(parseNote);

/** MIDI-style absolute pitch (C4 = 60) for a note in a given octave. */
export function midi(note: Note, octave: number): number {
  return 12 * (octave + 1) + LETTER_PC[note.letter] + note.acc;
}
