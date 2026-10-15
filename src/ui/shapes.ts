/**
 * Chord chart: every movable CAGED chord shape on one static, printable page.
 * No key is attached; each dot is labelled by its interval, and R marks the
 * root you line up with the chord you want.
 */
import { type CagedName, type MovableShape, CAGED_ORDER, CAGED_CHORD_IDS, chordById, movableShape, intervalLabel } from '../theory';
import { setState } from '../state';
import { h, s } from './dom';
import { degreeClass } from './controls';

const STRING_NAMES = ['6th', '5th', '4th', '3rd', '2nd', '1st'];

/** Root string of each shape (the same for every chord type). */
const ROOT_STRING: Record<CagedName, number> = { C: 1, A: 1, G: 0, E: 0, D: 2 };

/** One movable diagram: five frets tall, R on the root, intervals on every dot. */
function diagram(chordId: string, shape: MovableShape, title: string): SVGElement {
  const formula = chordById(chordId).formula;
  const rows = Math.max(4, shape.hi - shape.lo + 1);
  const gap = 18;
  const rowH = 22;
  const left = 22;
  const top = 26;
  const w = left + gap * 5 + 14;
  const hgt = top + rows * rowH + 8;
  const x = (str: number) => left + gap * str;
  const y = (rel: number) => top + (rel - shape.lo + 0.5) * rowH;
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, class: 'chart-diagram', role: 'img', 'aria-label': title });

  for (let r = 0; r <= rows; r++) svg.append(s('line', { x1: x(0), x2: x(5), y1: top + r * rowH, y2: top + r * rowH, class: 'dg-fret' }));
  for (let i = 0; i < 6; i++) svg.append(s('line', { x1: x(i), x2: x(i), y1: top, y2: top + rows * rowH, class: 'dg-string' }));
  // The root's fret, marked down the side so the shape can be slid into place.
  svg.append(s('text', { x: 4, y: y(0) + 4, class: 'chart-rootfret' }, 'R'));
  for (const m of shape.muted) svg.append(s('text', { x: x(m), y: top - 8, class: 'dg-mark' }, '×'));

  // A barre where the index finger covers several strings at the lowest fret (no muted strings under it).
  const atLo = shape.notes.filter((n) => n.rel === shape.lo).map((n) => n.string);
  if (atLo.length >= 2) {
    const from = Math.min(...atLo);
    const to = Math.max(...atLo);
    if (!shape.muted.some((m) => m > from && m < to)) {
      svg.append(s('rect', { x: x(from) - 7, y: y(shape.lo) - 7, width: x(to) - x(from) + 14, height: 14, rx: 7, class: 'chart-barre' }));
    }
  }
  for (const n of shape.notes) {
    const iv = formula.find((f) => f.semitones % 12 === n.semitones)!;
    const label = n.semitones === 0 ? 'R' : intervalLabel(iv);
    svg.append(
      s('g', { class: `dg-dot ${degreeClass(iv)} ${n.semitones === 0 ? 'root' : ''}` },
        s('circle', { cx: x(n.string), cy: y(n.rel), r: 8 }),
        s('text', { x: x(n.string), y: y(n.rel) + 3.5, class: label.length > 1 ? 'small' : '' }, label)),
    );
  }
  return svg;
}

export function renderShapes(root: HTMLElement): void {
  const rows = CAGED_CHORD_IDS.map((id) => {
    const chord = chordById(id);
    return h(
      'section',
      { class: 'chart-row' },
      h('h3', { class: 'chart-name' }, chord.name, chord.symbol ? h('small', {}, chord.symbol) : null),
      ...CAGED_ORDER.map((name) => {
        const shape = movableShape(id, name);
        return h('div', { class: `chart-cell ${shape ? '' : 'empty'}` },
          h('span', { class: 'chart-cell-label' }, `${name} shape`),
          shape ? diagram(id, shape, `${chord.name}, ${name} shape, root on the ${STRING_NAMES[ROOT_STRING[name]]} string`) : h('span', { class: 'chart-none', title: 'Not a commonly played shape for this chord' }, '–'));
      }),
    );
  });

  root.replaceChildren(
    h('div', { class: 'title-row chart-head' },
      h('h2', {}, 'Movable chord shapes'),
      h('div', { class: 'chart-actions' },
        h('button', { type: 'button', class: 'chip', onclick: () => setState({ view: 'fretboard', fretMode: 'caged' }) }, 'Try them in a key'),
        h('button', { type: 'button', class: 'chip strong', onclick: () => window.print() }, 'Print'))),
    h('p', { class: 'lead' },
      'Every chord type in its CAGED shapes. Slide a shape until R sits on the root you want: the E shape with R at fret 5 is A, the A shape with R at fret 3 is C. ',
      'Bars across the top fret are barres; × means don’t play that string.'),
    h('div', { class: 'chart-grid' },
      h('div', { class: 'chart-row chart-cols', 'aria-hidden': 'true' },
        h('span', {}),
        ...CAGED_ORDER.map((name) => h('span', {}, h('b', {}, `${name} shape`), h('small', {}, `root on ${STRING_NAMES[ROOT_STRING[name]]} string`)))),
      ...rows),
    h('ul', { class: 'legend degrees chart-key', 'aria-label': 'Dot colors' },
      ...[['1', 'R root'], ['2', '2 / 9'], ['3', '3 / ♭3'], ['4', '4'], ['5', '5 / ♭5'], ['6', '6'], ['7', '7 / ♭7']].map(([d, t]) => h('li', { class: `deg-${d}` }, h('i', {}), t))),
  );
}
