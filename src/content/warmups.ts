/**
 * Warm-up drills, written as string-and-fret cells so the fingering is fixed
 * (the point of a spider drill is which finger plays which fret).
 * Strings are numbered the usual way: 1 = high e, 6 = low E.
 */

export interface WarmupCell {
  /** 1 = high e ... 6 = low E. */
  string: number;
  fret: number;
  /** Beats; eighth notes by default. */
  dur?: number;
  /** Hammer-on or pull-off from the previous note: not picked. */
  legato?: boolean;
}

export interface WarmupEntry {
  id: string;
  name: string;
  /** What it is for and how to play it. */
  how: string;
  /** Builds the drill starting at `fret` (only used when `movable`). */
  cells: (fret: number) => WarmupCell[];
  /** Can start on any fret (chromatic drills). */
  movable?: boolean;
  /** Suggested starting tempo for eighth notes. */
  startBpm: number;
}

const STRINGS_UP = [6, 5, 4, 3, 2, 1];
const STRINGS_DOWN = [1, 2, 3, 4, 5, 6];

/** One finger per fret across every string and back: the classic "spider". */
function spider(order: number[]): (fret: number) => WarmupCell[] {
  return (f) => [
    ...STRINGS_UP.flatMap((s) => order.map((o) => ({ string: s, fret: f + o }))),
    ...STRINGS_DOWN.flatMap((s) => [...order].reverse().map((o) => ({ string: s, fret: f + o }))),
  ];
}

/** G major pentatonic in first position, low to high (string, fret). */
const G_PENT: [number, number][] = [
  [6, 3], [5, 0], [5, 2], [4, 0], [4, 2], [3, 0], [3, 2], [2, 0], [2, 3], [1, 0], [1, 3],
];

/** G major, three notes per string, position 1. */
const G_3NPS: [number, number][] = [
  [6, 3], [6, 5], [6, 7], [5, 3], [5, 5], [5, 7], [4, 4], [4, 5], [4, 7],
  [3, 4], [3, 5], [3, 7], [2, 5], [2, 7], [2, 8], [1, 5], [1, 7], [1, 8],
];

export const WARMUPS: WarmupEntry[] = [
  {
    id: 'open-strings',
    name: 'Open-string picking',
    how: 'Four even notes on each open string, low to high and back. Watch that downstrokes and upstrokes are equally loud and that the pick stays close to the strings. Relax the picking hand; let the motion come from the wrist.',
    cells: () => [
      ...STRINGS_UP.flatMap((s) => [0, 0, 0, 0].map(() => ({ string: s, fret: 0 }))),
      ...STRINGS_DOWN.slice(1, 5).flatMap((s) => [0, 0, 0, 0].map(() => ({ string: s, fret: 0 }))),
    ],
    startBpm: 80,
  },
  {
    id: 'string-cross',
    name: 'String crossing',
    how: 'Alternate between neighboring open strings: G and B, then D and G, then B and high e. Strict down-up picking means you cross "outside" one way and "inside" the other; both should sound the same.',
    cells: () => [
      ...[0, 1, 2, 3].flatMap(() => [{ string: 3, fret: 0 }, { string: 2, fret: 0 }]),
      ...[0, 1, 2, 3].flatMap(() => [{ string: 4, fret: 0 }, { string: 3, fret: 0 }]),
      ...[0, 1, 2, 3].flatMap(() => [{ string: 2, fret: 0 }, { string: 1, fret: 0 }]),
      ...[0, 1, 2, 3].flatMap(() => [{ string: 2, fret: 0 }, { string: 3, fret: 0 }]),
    ],
    startBpm: 80,
  },
  {
    id: 'spider-1234',
    name: 'Spider, 1-2-3-4',
    how: 'One finger per fret, every string, up and back. Keep each finger down until it is needed again and keep the fingertips close to the frets. Move the starting fret to warm up different parts of the neck.',
    cells: spider([0, 1, 2, 3]),
    movable: true,
    startBpm: 70,
  },
  {
    id: 'spider-1324',
    name: 'Spider, 1-3-2-4',
    how: 'The same drill with the fingers in a new order, which works independence between the middle and ring fingers. Go slower than you think you need to.',
    cells: spider([0, 2, 1, 3]),
    movable: true,
    startBpm: 60,
  },
  {
    id: 'trills',
    name: 'Hammer-on and pull-off trills',
    how: 'Pick the first note, then hammer on and pull off two frets above without picking again. Each note should be as loud as the picked one; pull slightly sideways to sound the lower note.',
    cells: (f) => STRINGS_UP.flatMap((s) => [
      { string: s, fret: f },
      { string: s, fret: f + 2, legato: true },
      { string: s, fret: f, legato: true },
      { string: s, fret: f + 2, legato: true },
    ]),
    movable: true,
    startBpm: 70,
  },
  {
    id: 'g-3nps',
    name: 'G major, three notes per string',
    how: 'Up and down the seven-note scale with the same three-note shape on each string. The even groups make the picking repeat on every string: ideal for building speed with the speed trainer.',
    cells: () => {
      const up = G_3NPS.map(([s, f]) => ({ string: s, fret: f }));
      return [...up, ...[...up].reverse().slice(1, -1)];
    },
    startBpm: 70,
  },
  {
    id: 'pent-threes',
    name: 'G pentatonic in threes',
    how: 'Climb the G major pentatonic scale in overlapping groups of three (1-2-3, 2-3-4, ...), then come back down. Sequences like this are the raw material of fiddle-tune phrasing.',
    cells: () => {
      const notes = G_PENT.map(([s, f]) => ({ string: s, fret: f }));
      const up = notes.slice(0, -2).flatMap((_, i) => notes.slice(i, i + 3));
      const rev = [...notes].reverse();
      const down = rev.slice(0, -2).flatMap((_, i) => rev.slice(i, i + 3));
      return [...up, ...down];
    },
    startBpm: 70,
  },
];

export const warmupById = (id: string): WarmupEntry => WARMUPS.find((w) => w.id === id) ?? WARMUPS[0];
