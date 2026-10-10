import { type Tuning, fretPc } from './fretboard';

export interface Voicing {
  /** Fret per string, low → high; null = muted, 0 = open. */
  frets: (number | null)[];
  /** Index into the chord's tones for each played string (null when muted). */
  tones: (number | null)[];
  /** Lowest fretted fret (1 for open-position shapes). */
  baseFret: number;
  /** A barre across strings [from, to] at `fret`, if the shape needs one. */
  barre?: { fret: number; from: number; to: number };
  fingers: number;
  omitsFifth: boolean;
}

export interface VoicingOptions {
  maxFret?: number;
  /** Largest stretch between the lowest and highest fretted note. */
  maxSpan?: number;
  minStrings?: number;
  limit?: number;
}

/**
 * Generate playable root-position voicings for a chord in any tuning.
 *
 * Rules: the root is the lowest note; every chord tone is present, except the
 * 5th may be dropped from chords with four or more notes; played strings are
 * contiguous (no muted string in the middle); fretted notes fit within a
 * four-fret stretch; and the grip needs at most four fingers, counting a barre
 * on the lowest fret as one finger.
 */
export function chordVoicings(tn: Tuning, tonePcs: number[], opts: VoicingOptions = {}): Voicing[] {
  const maxFret = opts.maxFret ?? 15;
  const span = (opts.maxSpan ?? 4) - 1;
  const minStrings = opts.minStrings ?? Math.min(tn.strings.length, 3);
  const limit = opts.limit ?? 30;
  const n = tn.strings.length;
  const toneOf = (s: number, f: number) => tonePcs.indexOf(fretPc(tn, s, f));
  const fifthIdx = tonePcs.length >= 4 ? 2 : -1; // formulas are 1 3 5 ...; the 5th sits at index 2

  const best = new Map<string, { v: Voicing; score: number }>();

  for (let w = 0; w + span <= maxFret; w++) {
    const lo = Math.max(1, w);
    const options: (number | null)[][] = [];
    for (let s = 0; s < n; s++) {
      const opt: (number | null)[] = [null];
      if (w <= 4 && toneOf(s, 0) >= 0) opt.push(0);
      for (let f = lo; f <= w + span && f <= maxFret; f++) if (toneOf(s, f) >= 0) opt.push(f);
      options.push(opt);
    }

    const frets: (number | null)[] = new Array(n).fill(null);
    const visit = (s: number) => {
      if (s === n) {
        consider(frets.slice(), w);
        return;
      }
      for (const f of options[s]) {
        frets[s] = f;
        visit(s + 1);
      }
    };
    visit(0);
  }

  function consider(frets: (number | null)[], w: number) {
    const played = frets.map((f, i) => (f === null ? -1 : i)).filter((i) => i >= 0);
    if (played.length < minStrings) return;
    const first = played[0];
    const last = played[played.length - 1];
    if (last - first + 1 !== played.length) return; // no muted strings in the middle

    const tones = frets.map((f, s) => (f === null ? null : toneOf(s, f)));
    if (tones[first] !== 0) return; // root in the bass

    const present = new Set(tones.filter((t): t is number => t !== null));
    const missing = tonePcs.map((_, i) => i).filter((i) => !present.has(i));
    const omitsFifth = missing.length === 1 && missing[0] === fifthIdx;
    if (missing.length && !omitsFifth) return;

    const fretted = frets.filter((f): f is number => f !== null && f > 0);
    const minF = fretted.length ? Math.min(...fretted) : 0;
    // Overlapping windows find the same shape; only keep it in the window that starts at its lowest fret.
    if (fretted.length ? minF !== w : w !== 0) return;

    // Finger count, allowing a barre on the lowest fret.
    const atMin = frets.map((f, i) => (f === minF && minF > 0 ? i : -1)).filter((i) => i >= 0);
    let fingers = fretted.length;
    let barre: Voicing['barre'];
    if (atMin.length >= 2) {
      const from = atMin[0];
      const to = atMin[atMin.length - 1];
      // A barre must not cross an open string.
      const crossesOpen = frets.slice(from, to + 1).some((f) => f === 0);
      if (!crossesOpen && (fingers > 4 || atMin.length >= 3)) {
        fingers = fingers - atMin.length + 1;
        barre = { fret: minF, from, to };
      }
    }
    if (fingers > 4) return;

    const v: Voicing = { frets, tones, baseFret: Math.max(1, minF), barre, fingers, omitsFifth };
    const score = played.length * 3 + frets.filter((f) => f === 0).length * 1.5 - fingers - (omitsFifth ? 2 : 0) - (barre ? 1 : 0);
    // One voicing per (position, bass string) keeps the library varied.
    const key = `${minF}:${first}`;
    const prev = best.get(key);
    if (!prev || score > prev.score) best.set(key, { v, score });
  }

  return [...best.values()]
    .map((x) => x.v)
    .sort((a, b) => a.baseFret - b.baseFret || firstPlayed(a) - firstPlayed(b))
    .slice(0, limit);
}

const firstPlayed = (v: Voicing) => v.frets.findIndex((f) => f !== null);

/** Tab-style name: "x32010", or "x-10-12-12-12-10" once any fret has two digits. */
export function voicingName(v: Voicing): string {
  const parts = v.frets.map((f) => (f === null ? 'x' : String(f)));
  return parts.join(parts.some((p) => p.length > 1) ? '-' : '');
}
