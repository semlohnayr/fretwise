import { type Interval, formula, transpose } from './intervals';
import { type Note } from './notes';

export interface ScaleDef {
  id: string;
  name: string;
  formula: Interval[];
  family: 'mode' | 'minor' | 'pentatonic' | 'blues';
  /** Short explanation shown next to the scale. */
  blurb: string;
}

export interface ModeInfo {
  id: string;
  name: string;
  /** Position within the major scale (1 = Ionian ... 7 = Locrian). */
  degree: number;
  /** Brightness rank: 1 = brightest (Lydian) ... 7 = darkest (Locrian). */
  brightness: number;
  quality: 'major' | 'minor' | 'diminished';
  /** The note that separates this mode from the plain major or minor scale. */
  characteristic: string;
  feel: string;
  harmony: string;
  examples: string;
}

export const MODES: ModeInfo[] = [
  {
    id: 'ionian', name: 'Ionian', degree: 1, brightness: 2, quality: 'major', characteristic: '7',
    feel: 'The plain major scale: settled, resolved, "home".',
    harmony: 'I – IV – V carry the whole key. The major 7th is a strong leading tone pulling up to the root.',
    examples: 'Most pop, country and bluegrass melodies in a major key.',
  },
  {
    id: 'dorian', name: 'Dorian', degree: 2, brightness: 4, quality: 'minor', characteristic: '6',
    feel: 'Minor, but with a raised 6th that keeps it from sounding sad. Soulful, a little hopeful.',
    harmony: 'Vamp i – IV (Dm – G in D Dorian). The major IV chord is the Dorian fingerprint.',
    examples: '"Oye Como Va", Miles Davis\' "So What", and the fiddle tune "Shady Grove".',
  },
  {
    id: 'phrygian', name: 'Phrygian', degree: 3, brightness: 6, quality: 'minor', characteristic: '♭2',
    feel: 'Dark and tense; the ♭2 a half step above the root gives a Spanish or metal flavor.',
    harmony: 'i – ♭II (Em – F) is the signature move. Flamenco leans on its major-tonic cousin, Phrygian dominant.',
    examples: 'Flamenco, and a lot of thrash and heavy metal riffing.',
  },
  {
    id: 'lydian', name: 'Lydian', degree: 4, brightness: 1, quality: 'major', characteristic: '♯4',
    feel: 'The brightest mode. The ♯4 floats, dreamy and a bit otherworldly.',
    harmony: 'I – II (F – G in F Lydian): a major chord a whole step up is the giveaway.',
    examples: 'Film scores, The Simpsons theme, Joe Satriani\'s "Flying in a Blue Dream".',
  },
  {
    id: 'mixolydian', name: 'Mixolydian', degree: 5, brightness: 3, quality: 'major', characteristic: '♭7',
    feel: 'Major with a flat 7th: bluesy, rootsy, a little rowdy.',
    harmony: 'I – ♭VII – IV (G – F – C). Dominant 7th chords live here.',
    examples: '"Old Joe Clark" and many fiddle tunes, classic rock, the "Norwegian Wood" melody.',
  },
  {
    id: 'aeolian', name: 'Aeolian', degree: 6, brightness: 5, quality: 'minor', characteristic: '♭6',
    feel: 'The natural minor scale: sad, serious, dramatic.',
    harmony: 'i – ♭VI – ♭VII (Am – F – G). Raise the 7th for a stronger V chord and you get harmonic minor.',
    examples: 'Most rock and pop songs in a minor key.',
  },
  {
    id: 'locrian', name: 'Locrian', degree: 7, brightness: 7, quality: 'diminished', characteristic: '♭5',
    feel: 'The darkest mode. The ♭5 makes the tonic chord diminished, so it never quite feels resolved.',
    harmony: 'The i° chord is unstable, so Locrian is used more as a color over a m7♭5 chord than as a key.',
    examples: 'Jazz soloing over half-diminished chords; occasional metal riffs.',
  },
];

const MODE_FORMULAS: Record<string, string> = {
  ionian: '1 2 3 4 5 6 7',
  dorian: '1 2 b3 4 5 6 b7',
  phrygian: '1 b2 b3 4 5 b6 b7',
  lydian: '1 2 3 #4 5 6 7',
  mixolydian: '1 2 3 4 5 6 b7',
  aeolian: '1 2 b3 4 5 b6 b7',
  locrian: '1 b2 b3 4 b5 b6 b7',
};

export const SCALES: ScaleDef[] = [
  ...MODES.map((m) => ({
    id: m.id,
    name: m.id === 'ionian' ? 'Major (Ionian)' : m.id === 'aeolian' ? 'Natural minor (Aeolian)' : m.name,
    formula: formula(MODE_FORMULAS[m.id]),
    family: 'mode' as const,
    blurb: m.feel,
  })),
  {
    id: 'harmonic-minor', name: 'Harmonic minor', formula: formula('1 2 b3 4 5 b6 7'), family: 'minor',
    blurb: 'Natural minor with a raised 7th, giving a major V chord. The ♭6–7 gap is an exotic-sounding augmented 2nd.',
  },
  {
    id: 'melodic-minor', name: 'Melodic minor', formula: formula('1 2 b3 4 5 6 7'), family: 'minor',
    blurb: 'Minor 3rd with a major-scale top half. The jazz minor scale.',
  },
  {
    id: 'major-pentatonic', name: 'Major pentatonic', formula: formula('1 2 3 5 6'), family: 'pentatonic',
    blurb: 'The major scale minus 4 and 7: no half steps, so nothing clashes. Bluegrass and country lead playing lives here.',
  },
  {
    id: 'minor-pentatonic', name: 'Minor pentatonic', formula: formula('1 b3 4 5 b7'), family: 'pentatonic',
    blurb: 'The first scale most guitarists learn: the natural minor minus 2 and ♭6. Rock and blues soloing.',
  },
  {
    id: 'blues', name: 'Blues (minor)', formula: formula('1 b3 4 b5 5 b7'), family: 'blues',
    blurb: 'Minor pentatonic plus the ♭5 "blue note" as a passing tone.',
  },
  {
    id: 'major-blues', name: 'Major blues', formula: formula('1 2 b3 3 5 6'), family: 'blues',
    blurb: 'Major pentatonic plus the ♭3, slid into the major 3rd. A staple of flatpicking and western swing.',
  },
];

export const scaleById = (id: string): ScaleDef => {
  const s = SCALES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scale ${id}`);
  return s;
};

export const modeById = (id: string): ModeInfo => {
  const m = MODES.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mode ${id}`);
  return m;
};

export function scaleNotes(root: Note, scale: ScaleDef): Note[] {
  return scale.formula.map((i) => transpose(root, i));
}

/**
 * The parent major key of a mode: D Dorian → C major.
 * (Walk back down from the mode root by the mode's position in the major scale.)
 */
export function parentMajor(root: Note, modeId: string): Note {
  const mode = modeById(modeId);
  const majorFormula = formula(MODE_FORMULAS.ionian);
  const offset = majorFormula[mode.degree - 1];
  return transpose(root, { degree: 9 - offset.degree, semitones: 12 - offset.semitones === 12 ? 0 : 12 - offset.semitones });
}
