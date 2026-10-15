import { type Note, n, pc, mod, noteName } from './notes';

export interface Tuning {
  id: string;
  name: string;
  /** Open strings from lowest-pitched (6th string on guitar) to highest. */
  strings: Note[];
}

const t = (id: string, name: string, s: string): Tuning => ({ id, name, strings: s.split(' ').map(n) });

export const TUNINGS: Tuning[] = [
  t('standard', 'Standard (E A D G B E)', 'E A D G B E'),
  t('half-down', 'Half step down (E♭)', 'Eb Ab Db Gb Bb Eb'),
  t('drop-d', 'Drop D', 'D A D G B E'),
  t('double-drop-d', 'Double drop D', 'D A D G B D'),
  t('dadgad', 'DADGAD', 'D A D G A D'),
  t('open-g', 'Open G', 'D G D G B D'),
  t('open-d', 'Open D', 'D A D F# A D'),
  t('open-e', 'Open E', 'E B E G# B E'),
  t('open-c', 'Open C', 'C G C G C E'),
  t('drop-c', 'Drop C', 'C G C F A D'),
];

export function parseTuning(text: string): Tuning {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 9) throw new Error('Enter between 3 and 9 strings, lowest first');
  return { id: 'custom', name: `Custom (${parts.join(' ')})`, strings: parts.map(n) };
}

export const tuningLabel = (tn: Tuning): string => tn.strings.map((s) => noteName(s)).join(' ');

/** Standard six-string tuning, required for CAGED. */
export function isStandard(tn: Tuning): boolean {
  const std = [4, 9, 2, 7, 11, 4];
  return tn.strings.length === 6 && tn.strings.every((s, i) => pc(s) === std[i]);
}

export const fretPc = (tn: Tuning, string: number, fret: number): number => mod(pc(tn.strings[string]) + fret, 12);

export interface Position {
  string: number;
  fret: number;
}

/** Every position on the neck whose pitch class is in `pcs`. */
export function positionsFor(tn: Tuning, pcs: Set<number>, maxFret: number): Position[] {
  const out: Position[] = [];
  tn.strings.forEach((_, s) => {
    for (let f = 0; f <= maxFret; f++) if (pcs.has(fretPc(tn, s, f))) out.push({ string: s, fret: f });
  });
  return out;
}

/* ---------------- CAGED ---------------- */

export type CagedName = 'C' | 'A' | 'G' | 'E' | 'D';
export const CAGED_ORDER: CagedName[] = ['C', 'A', 'G', 'E', 'D'];

interface ShapeTemplate {
  /** String index (0 = low E) that carries the reference root. */
  ref: number;
  /** Fret offsets from the reference root fret, low E → high e. null = not played. */
  offsets: (number | null)[];
}

/** Build a template from an open-position (or any-position) grip such as "x32010". */
function grip(ref: number, frets: string): ShapeTemplate {
  const f = frets.split('').map((c) => (c === 'x' ? null : Number(c)));
  const r0 = f[ref]!;
  return { ref, offsets: f.map((x) => (x === null ? null : x - r0)) };
}

/**
 * CAGED shapes for common chord types, each written as its familiar grip
 * (open position where there is one) with the string that carries the root
 * the shape is named and moved by. Moving a shape up the neck keeps every
 * fret's distance from that root. Shapes that are rarely played for a chord
 * type are left out rather than forced.
 */
export const CAGED_CHORDS: Record<string, Partial<Record<CagedName, ShapeTemplate>>> = {
  maj: { C: grip(1, 'x32010'), A: grip(1, 'x02220'), G: grip(0, '320003'), E: grip(0, '022100'), D: grip(2, 'xx0232') },
  min: { C: grip(1, 'x31013'), A: grip(1, 'x02210'), G: grip(0, '310033'), E: grip(0, '022000'), D: grip(2, 'xx0231') },
  '7': { C: grip(1, 'x32310'), A: grip(1, 'x02020'), G: grip(0, '320001'), E: grip(0, '020100'), D: grip(2, 'xx0212') },
  maj7: { C: grip(1, 'x32000'), A: grip(1, 'x02120'), G: grip(0, '320002'), E: grip(0, '021100'), D: grip(2, 'xx0222') },
  m7: { C: grip(1, 'x3131x'), A: grip(1, 'x02010'), E: grip(0, '020000'), D: grip(2, 'xx0211') },
  '6': { C: grip(1, 'x32210'), A: grip(1, 'x02222'), G: grip(0, '320000'), E: grip(0, '022120'), D: grip(2, 'xx0202') },
  m6: { A: grip(1, 'x02212'), E: grip(0, '022020'), D: grip(2, 'xx0201') },
  sus4: { C: grip(1, 'x33011'), A: grip(1, 'x02230'), G: grip(0, '330013'), E: grip(0, '022200'), D: grip(2, 'xx0233') },
  sus2: { C: grip(1, 'x30033'), A: grip(1, 'x02200'), G: grip(0, '300033'), D: grip(2, 'xx0230') },
  add9: { C: grip(1, 'x32030'), A: grip(1, 'x02420'), G: grip(0, '320203'), E: grip(0, '024100') },
  '9': { C: grip(1, 'x32333'), E: grip(0, '020102') },
  m7b5: { A: grip(1, 'x3434x'), E: grip(0, '7x776x'), D: grip(2, 'xx0111') },
  dim7: { A: grip(1, 'x3424x'), E: grip(0, '012020'), D: grip(2, 'xx0101') },
};

/**
 * Chord types (ids from CHORDS) that have CAGED shapes, in teaching order.
 * (Spelled out because JavaScript lists numeric-looking keys such as '7' first.)
 */
export const CAGED_CHORD_IDS = ['maj', 'min', '7', 'maj7', 'm7', '6', 'm6', 'sus4', 'sus2', 'add9', '9', 'm7b5', 'dim7'];

export interface CagedShape {
  name: CagedName;
  /** Fret per string (low → high), null if muted. */
  frets: (number | null)[];
  minFret: number;
  maxFret: number;
  /** Fret window used to box the matching scale position. */
  window: [number, number];
}

const STANDARD_PCS = [4, 9, 2, 7, 11, 4];

/**
 * All CAGED chord shapes for a root that fit on the neck (standard tuning),
 * sorted by position. Each shape usually appears once or twice below fret 22.
 */
export function cagedShapes(root: Note, quality: 'major' | 'minor', maxFret: number): CagedShape[] {
  return cagedChordShapes(root, quality === 'major' ? 'maj' : 'min', maxFret);
}

/** Every instance of every CAGED shape for a chord type that fits below `maxFret`, low to high. */
export function cagedChordShapes(root: Note, chordId: string, maxFret: number): CagedShape[] {
  const table = CAGED_CHORDS[chordId] ?? {};
  const out: CagedShape[] = [];
  for (const name of CAGED_ORDER) {
    const tpl = table[name];
    if (!tpl) continue;
    const played = tpl.offsets.filter((o): o is number => o !== null);
    const lo = Math.min(...played);
    const hi = Math.max(...played);
    let r = mod(pc(root) - STANDARD_PCS[tpl.ref], 12);
    if (r + lo < 0) r += 12;
    for (; r + hi <= maxFret; r += 12) {
      const frets = tpl.offsets.map((o) => (o === null ? null : r + o));
      const minFret = r + lo;
      const maxF = r + hi;
      out.push({ name, frets, minFret, maxFret: maxF, window: [Math.max(0, minFret - 1), Math.min(maxFret, maxF + 1)] });
    }
  }
  return out.sort((a, b) => a.minFret - b.minFret);
}

/* ---------------- Triad voicings ---------------- */

export interface TriadVoicing {
  /** Strings used (low → high). */
  strings: number[];
  frets: number[];
  /** Index into the triad (0 = root, 1 = third, 2 = fifth) for each string. */
  tones: number[];
  inversion: 0 | 1 | 2;
}

export const INVERSION_NAMES = ['Root position', '1st inversion', '2nd inversion'];

/**
 * Close-voiced triads on a set of three adjacent strings: each string plays a
 * different chord tone and the whole grip spans at most `maxSpan` frets.
 * Works in any tuning.
 */
export function triadVoicings(tn: Tuning, triadPcs: number[], stringSet: number[], maxFret: number, maxSpan = 5): TriadVoicing[] {
  const out: TriadVoicing[] = [];
  const [a, b, c] = stringSet;
  const fretsFor = (s: number, tone: number) => {
    const res: number[] = [];
    for (let f = mod(triadPcs[tone] - pc(tn.strings[s]), 12); f <= maxFret; f += 12) res.push(f);
    return res;
  };
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) {
    for (const fa of fretsFor(a, p[0]))
      for (const fb of fretsFor(b, p[1]))
        for (const fc of fretsFor(c, p[2])) {
          const fs = [fa, fb, fc];
          if (Math.max(...fs) - Math.min(...fs) > maxSpan - 1) continue;
          out.push({ strings: [a, b, c], frets: fs, tones: p, inversion: p[0] as 0 | 1 | 2 });
        }
  }
  return out.sort((x, y) => Math.min(...x.frets) - Math.min(...y.frets));
}

/* ---------------- Absolute pitch ---------------- */

/**
 * MIDI pitch of each open string. The lowest string is placed between B1 and
 * B♭2 (covers standard, drop and 7-string tunings); every higher string is
 * the nearest pitch above the one below it. Re-entrant tunings are not modelled.
 */
export function stringMidis(tn: Tuning): number[] {
  const out: number[] = [];
  tn.strings.forEach((s, i) => {
    const p = pc(s);
    if (i === 0) {
      let m = 36 + p; // C2 + pitch class
      if (m < 35) m += 12;
      if (m > 46) m -= 12;
      out.push(m);
    } else {
      const prev = out[i - 1];
      let m = prev - mod(prev, 12) + p;
      while (m <= prev) m += 12;
      out.push(m);
    }
  });
  return out;
}

export const fretMidi = (tn: Tuning, string: number, fret: number): number => stringMidis(tn)[string] + fret;

/* ---------------- Three notes per string ---------------- */

export interface NpsPosition {
  /** 1-based: position n starts on scale degree n on the lowest string. */
  number: number;
  /** Frets for each string, low → high (three per string). */
  frets: number[][];
  minFret: number;
  maxFret: number;
}

/**
 * Three-notes-per-string patterns for a seven-note scale. Position n starts
 * on scale degree n on the lowest string and climbs the scale, three notes
 * per string. Works in any tuning whose strings ascend.
 */
export function threeNps(tn: Tuning, rootPc: number, scaleSemis: number[], maxFret: number): NpsPosition[] {
  if (scaleSemis.length !== 7) return [];
  const opens = stringMidis(tn);
  const out: NpsPosition[] = [];
  for (let deg = 0; deg < 7; deg++) {
    // Lowest fret on the bottom string that sounds scale degree `deg`.
    const startFret = mod(rootPc + scaleSemis[deg] - pc(tn.strings[0]), 12);
    for (let base = startFret; base <= maxFret; base += 12) {
      // Build the ascending run of scale pitches from that note.
      const pitches: number[] = [];
      for (let k = 0; k < tn.strings.length * 3; k++) {
        const step = deg + k;
        pitches.push(opens[0] + base + scaleSemis[step % 7] + 12 * Math.floor(step / 7) - scaleSemis[deg]);
      }
      const frets = tn.strings.map((_, s) => pitches.slice(s * 3, s * 3 + 3).map((p) => p - opens[s]));
      const flat = frets.flat();
      const lo = Math.min(...flat);
      const hi = Math.max(...flat);
      if (lo < 0 || hi > maxFret) continue;
      out.push({ number: deg + 1, frets, minFret: lo, maxFret: hi });
      break; // one instance per position keeps the menu simple
    }
  }
  return out;
}

/* ---------------- Movable shapes (key-free) ---------------- */

export interface MovableNote {
  /** String index, 0 = low E. */
  string: number;
  /** Frets above (+) or below (−) the root's fret. */
  rel: number;
  /** Semitones above the root (0–11). */
  semitones: number;
}

export interface MovableShape {
  /** String that carries the root the shape is named and moved by. */
  ref: number;
  notes: MovableNote[];
  /** Lowest and highest relative fret used. */
  lo: number;
  hi: number;
  /** Strings not played. */
  muted: number[];
}

/** A CAGED chord shape with no key attached: where each note sits relative to the root. */
export function movableShape(chordId: string, name: CagedName): MovableShape | null {
  const tpl = CAGED_CHORDS[chordId]?.[name];
  if (!tpl) return null;
  const notes: MovableNote[] = [];
  const muted: number[] = [];
  tpl.offsets.forEach((rel, s) => {
    if (rel === null) muted.push(s);
    else notes.push({ string: s, rel, semitones: mod(STANDARD_PCS[s] + rel - STANDARD_PCS[tpl.ref], 12) });
  });
  const rels = notes.map((x) => x.rel);
  return { ref: tpl.ref, notes, lo: Math.min(...rels), hi: Math.max(...rels), muted };
}
