import { type Note, noteName, pc, mod } from './notes';
import { CIRCLE, harmonize, type DiatonicChord } from './keys';
import { scaleById } from './scales';

/** Open-position keys most players are comfortable in. */
export const SHAPE_KEYS = {
  major: ['G', 'C', 'D', 'A', 'E'],
  minor: ['Em', 'Am', 'Dm'],
} as const;

/** Spell a key root the way the circle of fifths does (D♭ not C♯ major, F♯ not G♭). */
export function keyRoot(pitch: number, quality: 'major' | 'minor'): Note {
  const slot = CIRCLE.find((s) => pc(quality === 'major' ? s.major : s.minor) === mod(pitch, 12))!;
  return quality === 'major' ? slot.major : slot.minor;
}

export interface CapoOption {
  /** Chord-shape key you finger, e.g. "G". */
  shape: Note;
  capo: number;
  /** Comfortable: capo at fret 7 or lower. */
  practical: boolean;
}

/** Every open-shape key that can sound in the target key, with the capo fret it needs. */
export function capoOptions(target: Note, quality: 'major' | 'minor'): CapoOption[] {
  const shapes = quality === 'major' ? SHAPE_KEYS.major : SHAPE_KEYS.minor;
  return shapes
    .map((name) => {
      const shape = keyRoot(pcOf(name.replace('m', '')), quality);
      const capo = mod(pc(target) - pc(shape), 12);
      return { shape, capo, practical: capo <= 7 };
    })
    .sort((a, b) => a.capo - b.capo);
}

const pcOf = (letter: string): number => ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[letter]!;

export interface CapoTranslation {
  sounding: Note;
  pairs: { shape: DiatonicChord; sounds: DiatonicChord }[];
}

/** Shape key + capo → the key that actually sounds, chord by chord. */
export function translateCapo(shapeKey: Note, quality: 'major' | 'minor', capo: number): CapoTranslation {
  const sounding = keyRoot(pc(shapeKey) + capo, quality);
  const scale = scaleById(quality === 'major' ? 'ionian' : 'aeolian');
  const a = harmonize(shapeKey, scale);
  const b = harmonize(sounding, scale);
  return { sounding, pairs: a.map((shape, i) => ({ shape, sounds: b[i] })) };
}

export const keyLabel = (root: Note, quality: 'major' | 'minor'): string =>
  `${noteName(root)}${quality === 'minor' ? 'm' : ''}`;
