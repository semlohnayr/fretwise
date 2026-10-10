/**
 * Random melodies that follow a few rules of thumb from melody writing:
 * mostly stepwise motion, an occasional leap that is answered by a step back
 * the other way, a range of about an octave and a half, a start on a chord
 * tone, and an ending that steps into the root on a long note.
 */
import { type Rng, pick } from './quiz';
import type { MelodyNote } from './abc';

export interface MelodyOptions {
  /** Pitch class of the key's root. */
  rootPc: number;
  /** Scale as semitones above the root (any length). */
  scale: number[];
  bars: number;
  beatsPerBar: number;
  rhythm: 'quarters' | 'eighths' | 'mixed';
  /** Lowest and highest MIDI pitch allowed. */
  low: number;
  high: number;
}

/** Every scale pitch inside [low, high], ascending. */
export function scaleRange(rootPc: number, scale: number[], low: number, high: number): number[] {
  const out: number[] = [];
  for (let m = low; m <= high; m++) {
    const rel = (((m - rootPc) % 12) + 12) % 12;
    if (scale.includes(rel)) out.push(m);
  }
  return out;
}

function rhythmFor(rng: Rng, opts: MelodyOptions): number[] {
  const durs: number[] = [];
  const total = opts.bars * opts.beatsPerBar;
  // Last two beats are a held final note.
  const body = total - 2;
  for (let b = 0; b < body; b++) {
    const r = rng();
    if (opts.rhythm === 'quarters') durs.push(1);
    else if (opts.rhythm === 'eighths') durs.push(0.5, 0.5);
    else if (r < 0.55) durs.push(0.5, 0.5);
    else if (r < 0.85) durs.push(1);
    else durs.push(0.75, 0.25);
  }
  durs.push(2);
  return durs;
}

export function randomMelody(rng: Rng, opts: MelodyOptions): MelodyNote[] {
  const pitches = scaleRange(opts.rootPc, opts.scale, opts.low, opts.high);
  if (pitches.length < 3) return [];
  const third = opts.scale.find((x) => x === 3 || x === 4) ?? 4;
  const isChordTone = (m: number) => [0, third, 7].includes((((m - opts.rootPc) % 12) + 12) % 12);
  const roots = pitches.filter((m) => (((m - opts.rootPc) % 12) + 12) % 12 === 0);
  const mid = Math.floor(pitches.length / 2);

  // Start on a chord tone near the middle of the range.
  const starts = pitches.map((m, i) => ({ m, i })).filter((x) => isChordTone(x.m) && Math.abs(x.i - mid) <= 3);
  let idx = starts.length ? pick(rng, starts).i : mid;

  const durs = rhythmFor(rng, opts);
  const out: number[] = [];
  let lastMove = 0;
  for (let k = 0; k < durs.length - 2; k++) {
    out.push(pitches[idx]);
    let move: number;
    if (Math.abs(lastMove) >= 2) move = -Math.sign(lastMove); // answer a leap with a step back
    else {
      const r = rng();
      const size = r < 0.62 ? 1 : r < 0.82 ? 2 : r < 0.92 ? 3 : r < 0.97 ? 4 : 0;
      // Lean back toward the middle of the range.
      const towardMiddle = idx < mid ? 1 : -1;
      const dir = rng() < 0.6 ? towardMiddle : -towardMiddle;
      move = size * dir;
    }
    if (idx + move < 0 || idx + move >= pitches.length) move = -move;
    idx = Math.min(pitches.length - 1, Math.max(0, idx + move));
    lastMove = move;
  }

  // Penultimate note: the scale step just above or below the nearest root, then the root.
  const current = pitches[idx];
  const root = roots.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a), roots[0] ?? pitches[0]);
  const ri = pitches.indexOf(root);
  const approach = ri + 1 < pitches.length && (ri === 0 || rng() < 0.5) ? pitches[ri + 1] : pitches[Math.max(0, ri - 1)];
  out.push(approach, root);

  return out.map((midi, k) => ({ midi, dur: durs[k], spelled: null }));
}
