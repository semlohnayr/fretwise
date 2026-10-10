/**
 * Tablature drawn as SVG with proportional spacing: horizontal distance is
 * time, so rhythm reads at a glance. Pick strokes sit above the staff,
 * chord symbols above those, and hammer-ons / pull-offs are marked h / p.
 */
import type { Stroke, TabPos } from '../theory';
import { s } from './dom';

export interface TabNote {
  onset: number;
  dur: number;
  pos: TabPos | null;
  pick: Stroke | null;
  legato?: boolean;
  /** Pitch went up (hammer-on) or down (pull-off) from the previous note. */
  up?: boolean;
  chord?: string;
  /** Extra class, e.g. a grading verdict. */
  cls?: string;
}

export interface TabOptions {
  stringNames: string[];
  beatsPerBar: number;
  /** Total beats to draw (whole bars). */
  length: number;
  barsPerLine?: number;
  /** Bar number of the first bar (for phrases from the middle of a tune). */
  firstBar?: number;
}

const BEAT_W = 56;
const STR_GAP = 13;
const LEFT = 26;
const TOP = 42;
const LINE_GAP = 40;

export function tabSvg(notes: TabNote[], o: TabOptions): SVGElement {
  const strings = o.stringNames.length;
  const bars = Math.max(1, Math.round(o.length / o.beatsPerBar));
  const perLine = Math.min(bars, o.barsPerLine ?? Math.max(1, Math.min(4, Math.round(16 / o.beatsPerBar))));
  const lines = Math.ceil(bars / perLine);
  const barW = BEAT_W * o.beatsPerBar;
  const staffH = STR_GAP * (strings - 1);
  const lineH = TOP + staffH + LINE_GAP;
  const width = LEFT + perLine * barW + 12;
  const height = lines * lineH;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'tab', role: 'img', 'aria-label': 'Tablature', preserveAspectRatio: 'xMinYMin meet' });

  // Staff y for a string (string 0 = lowest, drawn at the bottom like real tab).
  const ys = (line: number, str: number) => line * lineH + TOP + STR_GAP * (strings - 1 - str);
  const where = (beat: number) => {
    const bar = Math.min(bars - 1, Math.floor(beat / o.beatsPerBar + 1e-9));
    const line = Math.floor(bar / perLine);
    const x = LEFT + (bar % perLine) * barW + (beat - bar * o.beatsPerBar) * BEAT_W + 12;
    return { line, x };
  };

  for (let line = 0; line < lines; line++) {
    const barsHere = Math.min(perLine, bars - line * perLine);
    const x1 = LEFT + barsHere * barW;
    for (let str = 0; str < strings; str++) {
      svg.append(s('line', { x1: LEFT, x2: x1, y1: ys(line, str), y2: ys(line, str), class: 'tab-line' }));
      svg.append(s('text', { x: LEFT - 8, y: ys(line, str) + 3.5, class: 'tab-string' }, o.stringNames[str]));
    }
    for (let b = 0; b <= barsHere; b++) {
      const x = LEFT + b * barW;
      svg.append(s('line', { x1: x, x2: x, y1: ys(line, strings - 1), y2: ys(line, 0), class: 'tab-bar' }));
      if (b < barsHere) {
        svg.append(s('text', { x: x + 3, y: ys(line, 0) + 24, class: 'tab-barnum' }, String((o.firstBar ?? 1) + line * perLine + b)));
        // Beat ticks under the staff.
        for (let beat = 0; beat < o.beatsPerBar; beat++) {
          const bx = x + beat * BEAT_W + 12;
          svg.append(s('line', { x1: bx, x2: bx, y1: ys(line, 0) + 7, y2: ys(line, 0) + (beat === 0 ? 14 : 11), class: 'tab-tick' }));
        }
      }
    }
  }

  notes.forEach((n, i) => {
    if (n.onset >= bars * o.beatsPerBar - 1e-9) return;
    const { line, x } = where(n.onset);
    if (n.chord) svg.append(s('text', { x: x - 4, y: ys(line, strings - 1) - 30, class: 'tab-chord' }, n.chord));
    if (!n.pos) {
      // Rest: a small dash on the middle of the staff.
      return;
    }
    const y = ys(line, n.pos.string);
    const label = String(n.pos.fret);
    const w = label.length > 1 ? 15 : 9;
    const g = s('g', { class: `tab-note ${n.cls ?? ''}`, 'data-i': String(i) },
      s('rect', { x: x - w / 2, y: y - 6.5, width: w, height: 13, rx: 3 }),
      s('text', { x, y: y + 4 }, label));
    svg.append(g);
    if (n.legato) {
      svg.append(s('text', { x: x - BEAT_W * Math.min(0.5, n.dur) * 0.5 - 2, y: y - 9, class: 'tab-legato' }, n.up ? 'h' : 'p'));
    }
    if (n.pick) {
      const py = ys(line, strings - 1) - 16;
      svg.append(
        n.pick === 'down'
          ? s('path', { d: `M${x - 4} ${py + 4} V${py - 3} H${x + 4} V${py + 4}`, class: 'tab-pick' })
          : s('path', { d: `M${x - 4} ${py - 4} L${x} ${py + 4} L${x + 4} ${py - 4}`, class: 'tab-pick' }),
      );
    }
  });
  return svg;
}
