import { type ChordDef, identifyChord, chordSymbol } from './chords';
import { between, transpose, iv } from './intervals';
import { type Note, n, noteName, mod } from './notes';
import { type ScaleDef, scaleById, scaleNotes } from './scales';

/** One slot on the circle of fifths. Index 0 = C at 12 o'clock, clockwise in fifths. */
export interface CircleSlot {
  index: number;
  major: Note;
  minor: Note;
  /** Diminished vii° chord root of the major key (the innermost ring). */
  dim: Note;
  /** Enharmonic alternative major key, if commonly used (B/C♭, F♯/G♭, D♭/C♯). */
  altMajor?: Note;
  altMinor?: Note;
}

const MAJORS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const ALTS: Record<number, [string, string]> = { 5: ['Cb', 'Ab'], 6: ['Gb', 'Eb'], 7: ['C#', 'A#'] };

export const CIRCLE: CircleSlot[] = MAJORS.map((name, index) => {
  const major = n(name);
  const alt = ALTS[index];
  return {
    index,
    major,
    minor: transpose(major, iv(6, 9)),
    dim: transpose(major, iv(7, 11)),
    altMajor: alt ? n(alt[0]) : undefined,
    altMinor: alt ? n(alt[1]) : undefined,
  };
});

export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export interface KeySignature {
  sharps: number;
  flats: number;
  /** Altered notes in signature order, e.g. ["F♯", "C♯"]. */
  accidentals: string[];
}

/** Key signature of a major key, derived from its spelled scale. */
export function keySignature(majorTonic: Note): KeySignature {
  const notes = scaleNotes(majorTonic, scaleById('ionian'));
  const sharps = notes.filter((x) => x.acc > 0).reduce((s, x) => s + x.acc, 0);
  const flats = notes.filter((x) => x.acc < 0).reduce((s, x) => s - x.acc, 0);
  const order = sharps ? SHARP_ORDER : FLAT_ORDER;
  const sym = sharps ? '♯' : '♭';
  return { sharps, flats, accidentals: order.slice(0, sharps || flats).map((l) => l + sym) };
}

export function relativeMinor(major: Note): Note {
  return transpose(major, iv(6, 9));
}

export function relativeMajor(minor: Note): Note {
  return transpose(minor, iv(3, 3));
}

/** Slot index on the circle for a pitch class (major key). */
export function circleIndexOf(major: Note): number {
  const p = mod(noteToPc(major), 12);
  return CIRCLE.findIndex((s) => mod(noteToPc(s.major), 12) === p);
}

function noteToPc(x: Note): number {
  return [0, 2, 4, 5, 7, 9, 11][x.letter] + x.acc;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface DiatonicChord {
  degree: number;
  root: Note;
  notes: Note[];
  chord?: ChordDef;
  symbol: string;
  roman: string;
}

/** Roman numeral for a chord built on a scale degree, relative to the major scale. */
export function romanNumeral(tonic: Note, root: Note, chord: ChordDef | undefined): string {
  const i = between(tonic, root);
  const majorSemis = [0, 2, 4, 5, 7, 9, 11][i.degree - 1];
  const diff = i.semitones - majorSemis;
  const accidental = diff < 0 ? '♭'.repeat(-diff) : '♯'.repeat(diff);
  const base = ROMAN[i.degree - 1];
  const id = chord?.id ?? '';
  const minorish = ['min', 'dim', 'm7', 'm7b5', 'dim7', 'mMaj7', 'm6', 'm9'].includes(id);
  const numeral = minorish ? base.toLowerCase() : base;
  const suffix: Record<string, string> = {
    dim: '°', aug: '+', '7': '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: '(maj7)',
  };
  return accidental + numeral + (suffix[id] ?? '');
}

/** Stack thirds on every degree of a seven-note scale. */
export function harmonize(tonic: Note, scale: ScaleDef, sevenths = false): DiatonicChord[] {
  const notes = scaleNotes(tonic, scale);
  if (notes.length !== 7) return [];
  return notes.map((root, d) => {
    const stack = [0, 2, 4, ...(sevenths ? [6] : [])].map((k) => notes[(d + k) % 7]);
    const chord = identifyChord(root, stack);
    return {
      degree: d + 1,
      root,
      notes: stack,
      chord,
      symbol: chord ? chordSymbol(root, chord) : stack.map((x) => noteName(x)).join('-'),
      roman: romanNumeral(tonic, root, chord),
    };
  });
}

export interface Progression {
  name: string;
  /** Degree list, 1-based, into the given scale's harmonization. */
  degrees: number[];
  /** Scale used to harmonize (lets us borrow ♭VII from Mixolydian). */
  scaleId?: string;
  note: string;
}

export const MAJOR_PROGRESSIONS: Progression[] = [
  { name: 'Three-chord', degrees: [1, 4, 5, 1], note: 'The I, IV and V are the key and its two neighbors on the circle. Countless folk, country and bluegrass songs need nothing else.' },
  { name: 'Pop axis', degrees: [1, 5, 6, 4], note: 'Major, major, the relative minor, major. Rotate it to start on vi for a moodier feel.' },
  { name: 'ii – V – I', degrees: [2, 5, 1], note: 'Each chord moves down a fifth (counter-clockwise on the circle). The core of jazz harmony.' },
  { name: '’50s doo-wop', degrees: [1, 6, 4, 5], note: 'The relative minor softens the trip from I to IV.' },
  { name: 'Circle progression', degrees: [1, 4, 7, 3, 6, 2, 5, 1], note: 'Every diatonic chord, each a fifth below the last. Walks counter-clockwise around the circle.' },
  { name: 'Mixolydian rock', degrees: [1, 7, 4, 1], scaleId: 'mixolydian', note: 'Borrows ♭VII from the parallel Mixolydian mode.' },
];

export const MINOR_PROGRESSIONS: Progression[] = [
  { name: 'Minor three-chord', degrees: [1, 4, 5, 1], note: 'i – iv – v in natural minor. A minor v sounds modal and folky.' },
  { name: 'Harmonic minor cadence', degrees: [1, 4, 5, 1], scaleId: 'harmonic-minor', note: 'Raising the 7th turns v into V, which pulls home much harder.' },
  { name: 'Epic minor', degrees: [1, 6, 7, 1], note: 'i – ♭VI – ♭VII – i: the Aeolian rock and film-score cadence.' },
  { name: 'Descending', degrees: [1, 7, 6, 5], note: 'The bass walks down the scale. Natural minor v, often swapped for V.' },
];

export function progressionChords(tonic: Note, baseScaleId: string, p: Progression): DiatonicChord[] {
  const chords = harmonize(tonic, scaleById(p.scaleId ?? baseScaleId));
  return p.degrees.map((d) => chords[d - 1]);
}
