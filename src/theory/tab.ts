/**
 * Turning pitches into tab, and deciding pick direction.
 */
import { type Tuning, stringMidis } from './fretboard';

export interface TabPos {
  string: number;
  fret: number;
}

export interface TabOptions {
  maxFret?: number;
  /** "open": first position with open strings, as bluegrass guitar is usually played. "position": stay near `position`. */
  style?: 'open' | 'position';
  /** Preferred index-finger fret for "position" style. */
  position?: number;
  /** Capo fret: frets are computed above the capo and reported relative to it. */
  capo?: number;
}

/**
 * Choose a string and fret for every pitch, minimising hand movement.
 * Dynamic programming over (candidate position, hand position): open strings
 * leave the hand where it is, stretches wider than four frets cost a shift,
 * and string skips cost a little. Pitches that cannot be played get null.
 */
export function autoTab(tn: Tuning, pitches: (number | null)[], opts: TabOptions = {}): (TabPos | null)[] {
  const capo = opts.capo ?? 0;
  const maxFret = (opts.maxFret ?? 15) - capo;
  const opens = stringMidis(tn).map((m) => m + capo);
  const style = opts.style ?? 'open';
  const target = Math.max(1, (opts.position ?? 5) - capo);

  type State = { pos: TabPos; hand: number; cost: number; back: number };
  const layers: State[][] = [];
  const idx: number[] = []; // which pitches are playable notes (not rests or out of range)

  for (const p of pitches) {
    if (p === null) continue;
    const cands: TabPos[] = [];
    opens.forEach((o, s) => {
      const f = p - o;
      if (f >= 0 && f <= maxFret) cands.push({ string: s, fret: f });
    });
    if (!cands.length) continue;
    const prev = layers[layers.length - 1];
    const layer: State[] = [];
    for (const c of cands) {
      const local =
        style === 'open'
          ? (c.fret === 0 ? -0.4 : 0) + c.fret * 0.12
          : (c.fret === 0 ? 1.2 : 0) + Math.max(0, Math.abs(c.fret - (target + 1.5)) - 1.5) * 0.6;
      if (!prev) {
        // Open style starts in first position (index finger at fret 1) whenever the note fits there.
        const hand = style === 'open' ? (c.fret <= 4 ? 1 : c.fret - 3) : c.fret === 0 ? target : Math.max(1, Math.min(c.fret, target));
        layer.push({ pos: c, hand, cost: local, back: -1 });
        continue;
      }
      // Try arriving from every previous state, keeping only the best per resulting hand position.
      const byHand = new Map<number, State>();
      prev.forEach((ps, k) => {
        let hand = ps.hand;
        let move = 0;
        if (c.fret > 0) {
          // The hand covers frets hand..hand+3 (one finger per fret).
          if (c.fret < hand) {
            move = hand - c.fret;
            hand = c.fret;
          } else if (c.fret > hand + 3) {
            move = c.fret - (hand + 3);
            hand = c.fret - 3;
          }
        }
        const shift = move ? 1.5 + move * 0.5 : 0;
        const skip = Math.max(0, Math.abs(c.string - ps.pos.string) - 1) * 0.6;
        const same = c.string === ps.pos.string && c.fret === ps.pos.fret ? -0.1 : 0;
        const cost = ps.cost + local + shift + skip + same;
        const best = byHand.get(hand);
        if (!best || cost < best.cost) byHand.set(hand, { pos: c, hand, cost, back: k });
      });
      layer.push(...byHand.values());
    }
    layers.push(layer);
    idx.push(layers.length - 1);
  }

  // Trace back the cheapest path.
  const chosen: TabPos[] = new Array(layers.length);
  if (layers.length) {
    let k = layers[layers.length - 1].reduce((bi, s, j, arr) => (s.cost < arr[bi].cost ? j : bi), 0);
    for (let l = layers.length - 1; l >= 0; l--) {
      const st = layers[l][k];
      chosen[l] = st.pos;
      k = st.back;
    }
  }

  // Map back onto the input, leaving rests and unplayable pitches empty.
  const out: (TabPos | null)[] = [];
  let li = 0;
  for (const p of pitches) {
    if (p === null) {
      out.push(null);
      continue;
    }
    const playable = opens.some((o) => p - o >= 0 && p - o <= maxFret);
    out.push(playable ? chosen[li++] : null);
  }
  return out;
}

/* ---------- Pick direction ---------- */

export type Stroke = 'down' | 'up';
export type PickStyle = 'alternate' | 'economy';

export interface PickInput {
  onset: number;
  string: number | null;
  /** Hammer-on or pull-off: not picked. */
  legato?: boolean;
}

const near = (x: number, grid: number) => Math.abs(x / grid - Math.round(x / grid)) < 1e-6;

/**
 * Alternate picking tied to the beat, the way bluegrass players are taught:
 * downstrokes on the beat and on-beat eighths, upstrokes on the off-beat
 * eighths, so the hand keeps moving through rests and slurred notes.
 * Sixteenths use the same idea on a sixteenth grid; anything else alternates.
 */
export function alternatePicks(notes: PickInput[]): (Stroke | null)[] {
  let last: Stroke = 'up';
  return notes.map((n) => {
    if (n.string === null || n.legato) return null;
    let s: Stroke;
    if (near(n.onset, 0.5)) s = Math.round(n.onset / 0.5) % 2 === 0 ? 'down' : 'up';
    else if (near(n.onset, 0.25)) s = Math.round(n.onset / 0.25) % 2 === 0 ? 'down' : 'up';
    else s = last === 'down' ? 'up' : 'down';
    last = s;
    return s;
  });
}

/**
 * Economy picking: alternate, except that when the next note is on the
 * neighbouring string in the direction the pick is already travelling, the
 * pick sweeps through with the same stroke. Downstrokes travel toward the
 * higher-pitched strings, upstrokes toward the lower ones.
 */
export function economyPicks(notes: PickInput[]): (Stroke | null)[] {
  let last: Stroke | null = null;
  let lastString: number | null = null;
  return notes.map((n) => {
    if (n.string === null || n.legato) return null;
    let s: Stroke;
    if (last === null || lastString === null) s = 'down';
    else if (last === 'down' && n.string === lastString + 1) s = 'down';
    else if (last === 'up' && n.string === lastString - 1) s = 'up';
    else s = last === 'down' ? 'up' : 'down';
    last = s;
    lastString = n.string;
    return s;
  });
}

/** Read an explicit pattern such as "DUUDUUDU" (repeated as needed) onto the picked notes. */
export function patternPicks(notes: PickInput[], pattern: string): (Stroke | null)[] {
  const p = pattern.replace(/[^DU]/gi, '').toUpperCase();
  let k = 0;
  return notes.map((n) => {
    if (n.string === null || n.legato || !p) return null;
    const s = p[k % p.length] === 'D' ? 'down' : 'up';
    k++;
    return s;
  });
}
