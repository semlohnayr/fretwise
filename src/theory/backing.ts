/**
 * Chord symbols and a boom-chuck backing pattern: bass note on the strong
 * beats (alternating root and fifth), a short chord "chuck" on the off beats.
 */
import { type Note, parseNote, pc } from './notes';
import { type ChordDef, chordById, chordNotes } from './chords';

const SUFFIXES: [RegExp, string][] = [
  [/^(maj7|M7|Δ7?)$/, 'maj7'],
  [/^(m7b5|ø7?|m7♭5)$/, 'm7b5'],
  [/^(dim7|°7)$/, 'dim7'],
  [/^(dim|°)$/, 'dim'],
  [/^(aug|\+)$/, 'aug'],
  [/^(m7|min7|-7)$/, 'm7'],
  [/^(m6|min6)$/, 'm6'],
  [/^(m|min|-)$/, 'min'],
  [/^7$/, '7'],
  [/^9$/, '9'],
  [/^6$/, '6'],
  [/^sus4?$/, 'sus4'],
  [/^sus2$/, 'sus2'],
  [/^5$/, '5'],
  [/^(maj|M)?$/, 'maj'],
];

/** "Em", "A7", "F#m7", "Bb", "D/F#" (bass ignored) → root and chord type. */
export function parseChordSymbol(sym: string): { root: Note; chord: ChordDef } | null {
  const m = /^([A-G])([#b♯♭]?)([^/]*)/.exec(sym.trim());
  if (!m) return null;
  let root: Note;
  try {
    root = parseNote(m[1] + (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2]));
  } catch {
    return null;
  }
  const suffix = m[3].trim();
  const hit = SUFFIXES.find(([re]) => re.test(suffix));
  return { root, chord: chordById(hit ? hit[1] : 'maj') };
}

export interface ChordSpan {
  /** Beat where this chord starts. */
  start: number;
  end: number;
  root: Note;
  chord: ChordDef;
  symbol: string;
}

/** Chord changes from symbols at onsets, each lasting until the next (or `length`). */
export function chordSpans(changes: { onset: number; symbol: string }[], length: number): ChordSpan[] {
  const out: ChordSpan[] = [];
  changes.forEach((c, i) => {
    const parsed = parseChordSymbol(c.symbol);
    if (!parsed) return;
    const end = i + 1 < changes.length ? changes[i + 1].onset : length;
    if (out.length && out[out.length - 1].symbol === c.symbol) {
      out[out.length - 1].end = end;
      return;
    }
    out.push({ start: c.onset, end, root: parsed.root, chord: parsed.chord, symbol: c.symbol });
  });
  return out;
}

export interface BackingEvent {
  beat: number;
  kind: 'bass' | 'chuck';
  midis: number[];
}

/**
 * Boom-chuck for the beats [from, to): bass on beats 1 and 3 (root then fifth,
 * so it walks), chuck on 2 and 4. In 2/4 or 3/4 the bass falls on beat 1.
 */
export function boomChuck(spans: ChordSpan[], beatsPerBar: number, loopLength: number, from: number, to: number): BackingEvent[] {
  const out: BackingEvent[] = [];
  if (!spans.length) return out;
  for (let b = Math.ceil(from - 1e-9); b < to; b++) {
    const local = ((b % loopLength) + loopLength) % loopLength;
    const span = spans.find((s) => local >= s.start - 1e-9 && local < s.end - 1e-9) ?? spans[spans.length - 1];
    const inBar = ((b % beatsPerBar) + beatsPerBar) % beatsPerBar;
    const rootPc = pc(span.root);
    const bassRoot = 40 + ((rootPc - 4 + 12) % 12); // between E2 and D#3
    const fifth = bassRoot + 7 > 52 ? bassRoot - 5 : bassRoot + 7;
    if (inBar === 0 || (beatsPerBar === 4 && inBar === 2)) {
      // Root on the downbeat; alternate to the fifth mid-bar or on the second bar of a held chord.
      const barsIntoChord = Math.floor((local - span.start) / beatsPerBar);
      const useFifth = beatsPerBar === 4 ? inBar === 2 : barsIntoChord % 2 === 1;
      out.push({ beat: b, kind: 'bass', midis: [useFifth ? fifth : bassRoot] });
    } else {
      // Close-position chord in the middle of the guitar range.
      const tones = chordNotes(span.root, span.chord).slice(0, 4).map(pc);
      const base = 52 + ((tones[0] - 4 + 12) % 12); // root between E3 and D#4
      out.push({ beat: b, kind: 'chuck', midis: tones.map((t) => base + ((t - tones[0] + 12) % 12)) });
    }
  }
  return out;
}

/** Spans for a progression given as chord symbols, `beatsEach` beats per chord. */
export function progressionSpans(symbols: string[], beatsEach: number): ChordSpan[] {
  return chordSpans(symbols.map((symbol, i) => ({ onset: i * beatsEach, symbol })), symbols.length * beatsEach);
}
