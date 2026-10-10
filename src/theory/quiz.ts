import { type Tuning, fretPc, stringMidis } from './fretboard';
import { CHORDS, type ChordDef } from './chords';

/** Random source in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;

export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
export const randInt = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

/** Small seeded PRNG (mulberry32) for tests and reproducible sessions. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Intervals by size ---------- */

export interface IntervalChoice {
  semitones: number;
  name: string;
  short: string;
}

export const INTERVAL_CHOICES: IntervalChoice[] = [
  { semitones: 1, name: 'Minor 2nd', short: 'm2' },
  { semitones: 2, name: 'Major 2nd', short: 'M2' },
  { semitones: 3, name: 'Minor 3rd', short: 'm3' },
  { semitones: 4, name: 'Major 3rd', short: 'M3' },
  { semitones: 5, name: 'Perfect 4th', short: 'P4' },
  { semitones: 6, name: 'Tritone', short: 'TT' },
  { semitones: 7, name: 'Perfect 5th', short: 'P5' },
  { semitones: 8, name: 'Minor 6th', short: 'm6' },
  { semitones: 9, name: 'Major 6th', short: 'M6' },
  { semitones: 10, name: 'Minor 7th', short: 'm7' },
  { semitones: 11, name: 'Major 7th', short: 'M7' },
  { semitones: 12, name: 'Octave', short: 'P8' },
];

/** A gentler starting set for ear training. */
export const BASIC_INTERVALS = [3, 4, 5, 7, 12];

/* ---------- Question generators ---------- */

export interface NoteFindQuestion {
  string: number;
  fret: number;
  answer: number; // pitch class
}

const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];

export function noteFindQuestion(rng: Rng, tn: Tuning, maxFret: number, naturalsOnly: boolean, strings?: number[]): NoteFindQuestion {
  const allowed = strings && strings.length ? strings : tn.strings.map((_, i) => i);
  for (;;) {
    const string = pick(rng, allowed);
    const fret = randInt(rng, 0, maxFret);
    const answer = fretPc(tn, string, fret);
    if (!naturalsOnly || NATURAL_PCS.includes(answer)) return { string, fret, answer };
  }
}

export interface FretIntervalQuestion {
  low: { string: number; fret: number };
  high: { string: number; fret: number };
  answer: number; // semitones
}

/** Two notes near each other on the neck, the second higher than the first. */
export function fretIntervalQuestion(rng: Rng, tn: Tuning, maxFret: number, allowed: number[]): FretIntervalQuestion {
  const opens = stringMidis(tn);
  for (;;) {
    const s1 = randInt(rng, 0, tn.strings.length - 1);
    const s2 = Math.min(tn.strings.length - 1, s1 + randInt(rng, 0, 2));
    const f1 = randInt(rng, 0, maxFret);
    const f2 = f1 + randInt(rng, -3, 4);
    if (f2 < 0 || f2 > maxFret) continue;
    const semis = opens[s2] + f2 - (opens[s1] + f1);
    if (allowed.includes(semis)) return { low: { string: s1, fret: f1 }, high: { string: s2, fret: f2 }, answer: semis };
  }
}

export interface EarIntervalQuestion {
  lowMidi: number;
  answer: number;
  harmonic: boolean;
}

export function earIntervalQuestion(rng: Rng, allowed: number[], harmonic: boolean): EarIntervalQuestion {
  return { lowMidi: randInt(rng, 48, 64), answer: pick(rng, allowed), harmonic };
}

/** Chord qualities offered in the chord ear-training quiz. */
export const QUIZ_CHORDS = ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'm7b5'];

export interface ChordQuizQuestion {
  rootMidi: number;
  chord: ChordDef;
}

export function chordQuizQuestion(rng: Rng, chordIds: string[]): ChordQuizQuestion {
  const id = pick(rng, chordIds);
  return { rootMidi: randInt(rng, 48, 58), chord: CHORDS.find((c) => c.id === id)! };
}
