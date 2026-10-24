/**
 * Mandolin and bass helpers: movable "chop" grips, mandolin positions,
 * one-position arpeggio boxes for bass, and simple bass lines.
 */
import { type Note, pc, mod } from './notes';
import { type Tuning, type Position, fretPc, stringMidis } from './fretboard';
import type { DiatonicChord } from './keys';

/* ---------------- Closed (movable) grips ---------------- */

export interface Grip {
  /** Fret per string, low → high. Every string is fretted, so the grip moves anywhere. */
  frets: number[];
  /** Semitones above the root for each string (0 = root). */
  tones: number[];
  /** Lowest fret in the grip. */
  lo: number;
  hi: number;
}

/**
 * Every grip that frets all strings within a four-fret span and contains each
 * chord tone (the 5th may be left out when there are more tones than strings).
 * Because no string is open, each grip is movable: on mandolin these are the
 * chop chords. Grips are returned once each, at their lowest position on the
 * neck (lowest fret 1 or higher), lowest first.
 */
export function closedGrips(tn: Tuning, rootPc: number, semis: number[], maxSpan = 4): Grip[] {
  const n = tn.strings.length;
  const tones = semis.map((x) => mod(x, 12));
  const required = tones.length > n ? tones.filter((x) => x !== 7) : tones;
  const seen = new Set<string>();
  const out: Grip[] = [];
  for (let lo = 1; lo <= 12; lo++) {
    const options: number[][] = [];
    for (let s = 0; s < n; s++) {
      const opt: number[] = [];
      for (let f = lo; f < lo + maxSpan; f++) if (tones.includes(mod(fretPc(tn, s, f) - rootPc, 12))) opt.push(f);
      options.push(opt);
    }
    const frets: number[] = [];
    const visit = (s: number) => {
      if (s === n) {
        if (Math.min(...frets) !== lo) return; // counted at its own lowest fret
        const t = frets.map((f, i) => mod(fretPc(tn, i, f) - rootPc, 12));
        if (!required.every((r) => t.includes(r)) || !t.includes(0)) return;
        // The same grip comes round again 12 frets up; keep the lower one.
        const shapeKey = frets.map((f) => f - lo).join('-');
        if (seen.has(shapeKey)) return;
        seen.add(shapeKey);
        out.push({ frets: frets.slice(), tones: t, lo, hi: Math.max(...frets) });
        return;
      }
      for (const f of options[s]) {
        frets.push(f);
        visit(s + 1);
        frets.pop();
      }
    };
    visit(0);
  }
  return out;
}

/**
 * Open-position grips: every string played, at least one open, fretted notes
 * within frets 1–4 and a four-fret stretch, every chord tone present (the
 * 5th may go when there are more tones than strings). Easiest first: lowest
 * reach, then fewest fretted notes.
 */
export function openGrips(tn: Tuning, rootPc: number, semis: number[], limit = 2): (Grip & { open: true })[] {
  const n = tn.strings.length;
  const tones = semis.map((x) => mod(x, 12));
  const required = tones.length > n ? tones.filter((x) => x !== 7) : tones;
  const options = tn.strings.map((_, s) => [0, 1, 2, 3, 4].filter((f) => tones.includes(mod(fretPc(tn, s, f) - rootPc, 12))));
  const found: (Grip & { open: true })[] = [];
  const frets: number[] = [];
  const visit = (s: number) => {
    if (s === n) {
      const fretted = frets.filter((f) => f > 0);
      if (fretted.length === n || fretted.length === 0) return;
      if (Math.max(...fretted) - Math.min(...fretted) > 3) return;
      const t = frets.map((f, i) => mod(fretPc(tn, i, f) - rootPc, 12));
      if (!required.every((r) => t.includes(r))) return;
      found.push({ frets: frets.slice(), tones: t, lo: 0, hi: Math.max(...fretted), open: true });
      return;
    }
    for (const f of options[s]) {
      frets.push(f);
      visit(s + 1);
      frets.pop();
    }
  };
  visit(0);
  const fretted = (g: Grip) => g.frets.filter((f) => f > 0).length;
  return found.sort((a, b) => a.hi - b.hi || fretted(a) - fretted(b)).slice(0, limit);
}

/* ---------------- Mandolin positions ---------------- */

/**
 * A mandolin position covers seven frets with two frets per finger (index on
 * the first two, pinky on the seventh). Because the strings are a fifth
 * apart, every note in that window appears exactly once.
 */
export const POSITION_SPAN = 7;

export const inPosition = (fret: number, start: number): boolean => fret >= start && fret < start + POSITION_SPAN;

export interface MandolinPosition {
  start: number;
  /** String carrying the root under the first finger (0 = G string), if any. */
  rootString: number | null;
}

/**
 * Useful positions for a key: open position, then every position whose
 * first finger lands on the root on the G or D string.
 */
export function mandolinPositions(tn: Tuning, rootPc: number, maxStart = 10): MandolinPosition[] {
  const out: MandolinPosition[] = [{ start: 0, rootString: null }];
  for (let s = 0; s < Math.min(2, tn.strings.length); s++) {
    for (let f = 1; f <= maxStart; f++) if (fretPc(tn, s, f) === rootPc) out.push({ start: f, rootString: s });
  }
  const seen = new Set<number>();
  return out.filter((p) => !seen.has(p.start) && seen.add(p.start)).sort((a, b) => a.start - b.start);
}

/* ---------------- Bass arpeggio boxes ---------------- */

export interface ArpBox {
  /** First fret of the four-fret window (one finger per fret). */
  start: number;
  rootString: number;
  rootFret: number;
  /** Chord tones in the window, lowest pitch first, from the root upward. */
  notes: (Position & { midi: number; semis: number })[];
}

/**
 * Chord tones in one hand position, starting from the root on `rootString`.
 * The window is four frets wide (one finger per fret); of the windows that
 * contain the root, the one holding the most chord tones wins.
 */
export function arpeggioBox(tn: Tuning, rootPc: number, semis: number[], rootString: number, minFret = 1): ArpBox {
  const opens = stringMidis(tn);
  let rootFret = mod(rootPc - pc(tn.strings[rootString]), 12);
  if (rootFret < minFret) rootFret += 12;
  const rootMidi = opens[rootString] + rootFret;
  const tones = semis.map((x) => mod(x, 12));
  let best: ArpBox | null = null;
  for (const start of [rootFret - 1, rootFret, rootFret - 2, rootFret - 3]) {
    if (start < 0) continue;
    const notes: ArpBox['notes'] = [];
    for (let s = rootString; s < tn.strings.length; s++) {
      for (let f = start; f < start + 4; f++) {
        const midi = opens[s] + f;
        const iv = mod(midi - rootMidi, 12);
        if (midi >= rootMidi && tones.includes(iv)) notes.push({ string: s, fret: f, midi, semis: midi - rootMidi });
      }
    }
    notes.sort((a, b) => a.midi - b.midi);
    // Keep one position per pitch (the lower string wins, as it reads up the box).
    const uniq = notes.filter((x, i) => i === 0 || x.midi !== notes[i - 1].midi);
    if (!best || uniq.length > best.notes.length) best = { start, rootString, rootFret, notes: uniq };
  }
  return best!;
}

/* ---------------- Bass lines ---------------- */

export type BassStyle = 'root-five' | 'walking';

export interface BassNote {
  /** Beat (quarter note) the note starts on, from 0. */
  beat: number;
  beats: number;
  midi: number;
  /** What the note is doing: R, 3, 5, or "→" for an approach note. */
  role: string;
  /** Index of the chord (bar) it belongs to. */
  bar: number;
}

/** Root of a chord in the bass's lowest octave: from the lowest open string up. */
function bassRoot(low: number, root: Note): number {
  return low + mod(pc(root) - low, 12);
}

/**
 * One bar per chord in 4/4.
 * - root-five: root on beat 1 and the fifth on beat 3, as half notes. The
 *   fifth goes below the root when the instrument reaches it. This is the
 *   bluegrass and country "boom" bass.
 * - walking: root, third, fifth, then a note a half step from the next root
 *   (below it when possible), so every bar leads into the next.
 */
export function bassLine(tn: Tuning, chords: DiatonicChord[], style: BassStyle): BassNote[] {
  const low = stringMidis(tn)[0];
  const out: BassNote[] = [];
  chords.forEach((c, bar) => {
    const r = bassRoot(low, c.root);
    const third = mod(pc(c.notes[1]) - pc(c.root), 12);
    const fifth = mod(pc(c.notes[2]) - pc(c.root), 12);
    const at = bar * 4;
    if (style === 'root-five') {
      const five = r + fifth - 12 >= low ? r + fifth - 12 : r + fifth;
      out.push({ beat: at, beats: 2, midi: r, role: 'R', bar }, { beat: at + 2, beats: 2, midi: five, role: '5', bar });
    } else {
      const next = chords[(bar + 1) % chords.length];
      const nr = bassRoot(low, next.root);
      // Approach from below when the bass can reach it; from above otherwise.
      const approach = nr - 1 >= low ? nr - 1 : nr + 1;
      out.push(
        { beat: at, beats: 1, midi: r, role: 'R', bar },
        { beat: at + 1, beats: 1, midi: r + third, role: third === 3 ? '♭3' : '3', bar },
        { beat: at + 2, beats: 1, midi: r + fifth, role: fifth === 6 ? '♭5' : '5', bar },
        { beat: at + 3, beats: 1, midi: approach, role: '→', bar },
      );
    }
  });
  return out;
}
