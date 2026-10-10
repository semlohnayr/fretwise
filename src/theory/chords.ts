import { type Interval, formula, transpose, between } from './intervals';
import { type Note, noteName, pc } from './notes';

export interface ChordDef {
  id: string;
  name: string;
  /** Suffix appended to the root, e.g. "m7♭5". */
  symbol: string;
  formula: Interval[];
  /** Base triad quality, used for CAGED shapes. */
  triad?: 'major' | 'minor';
  blurb: string;
}

export const CHORDS: ChordDef[] = [
  { id: 'maj', name: 'Major', symbol: '', formula: formula('1 3 5'), triad: 'major', blurb: 'Root, major 3rd, perfect 5th. Bright and stable.' },
  { id: 'min', name: 'Minor', symbol: 'm', formula: formula('1 b3 5'), triad: 'minor', blurb: 'Lower the 3rd a half step and the chord turns minor.' },
  { id: 'dim', name: 'Diminished', symbol: '°', formula: formula('1 b3 b5'), blurb: 'Two stacked minor 3rds. Tense; wants to resolve.' },
  { id: 'aug', name: 'Augmented', symbol: '+', formula: formula('1 3 #5'), blurb: 'Two stacked major 3rds. Symmetrical and unresolved.' },
  { id: 'sus2', name: 'Suspended 2nd', symbol: 'sus2', formula: formula('1 2 5'), blurb: 'The 3rd replaced by the 2nd: neither major nor minor.' },
  { id: 'sus4', name: 'Suspended 4th', symbol: 'sus4', formula: formula('1 4 5'), blurb: 'The 3rd replaced by the 4th, which usually resolves down to the 3rd.' },
  { id: '5', name: 'Power chord', symbol: '5', formula: formula('1 5'), blurb: 'Root and 5th only. No 3rd, so it works over major or minor.' },
  { id: '6', name: 'Major 6th', symbol: '6', formula: formula('1 3 5 6'), blurb: 'Major triad plus the 6th. Sweet, vintage sound.' },
  { id: 'm6', name: 'Minor 6th', symbol: 'm6', formula: formula('1 b3 5 6'), blurb: 'Minor triad with a major 6th: the Dorian chord.' },
  { id: '7', name: 'Dominant 7th', symbol: '7', formula: formula('1 3 5 b7'), blurb: 'Major triad plus ♭7. The V chord that pulls home; the backbone of the blues.' },
  { id: 'maj7', name: 'Major 7th', symbol: 'maj7', formula: formula('1 3 5 7'), blurb: 'Major triad plus the major 7th. Lush and jazzy.' },
  { id: 'm7', name: 'Minor 7th', symbol: 'm7', formula: formula('1 b3 5 b7'), blurb: 'Minor triad plus ♭7. Smooth; the ii chord in ii–V–I.' },
  { id: 'mMaj7', name: 'Minor-major 7th', symbol: 'm(maj7)', formula: formula('1 b3 5 7'), blurb: 'Minor triad with a major 7th. Spy-movie tension.' },
  { id: 'm7b5', name: 'Half-diminished', symbol: 'm7♭5', formula: formula('1 b3 b5 b7'), blurb: 'Diminished triad plus ♭7. The vii chord of a major key, ii of a minor key.' },
  { id: 'dim7', name: 'Diminished 7th', symbol: '°7', formula: formula('1 b3 b5 bb7'), blurb: 'Stacked minor 3rds all the way up. Every shape repeats every 3 frets.' },
  { id: 'add9', name: 'Add 9', symbol: 'add9', formula: formula('1 3 5 9'), blurb: 'Major triad plus the 9th, no 7th.' },
  { id: '9', name: 'Dominant 9th', symbol: '9', formula: formula('1 3 5 b7 9'), blurb: 'Dominant 7th plus the 9th. Funk and blues.' },
  { id: 'maj9', name: 'Major 9th', symbol: 'maj9', formula: formula('1 3 5 7 9'), blurb: 'Major 7th plus the 9th.' },
  { id: 'm9', name: 'Minor 9th', symbol: 'm9', formula: formula('1 b3 5 b7 9'), blurb: 'Minor 7th plus the 9th.' },
];

export const chordById = (id: string): ChordDef => {
  const c = CHORDS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown chord ${id}`);
  return c;
};

export function chordNotes(root: Note, chord: ChordDef): Note[] {
  return chord.formula.map((i) => transpose(root, i));
}

export function chordSymbol(root: Note, chord: ChordDef): string {
  return noteName(root) + chord.symbol;
}

/**
 * Identify a chord from a root plus stacked notes (used when harmonizing
 * scales). Matches on the set of intervals above the root.
 */
export function identifyChord(root: Note, notes: Note[]): ChordDef | undefined {
  const key = (ivs: Interval[]) => ivs.map((i) => `${((i.degree - 1) % 7) + 1}:${i.semitones % 12}`).sort().join(',');
  const target = key(notes.map((x) => between(root, x)));
  return CHORDS.find((c) => key(c.formula) === target);
}

export function pitchClasses(notes: Note[]): Set<number> {
  return new Set(notes.map(pc));
}
