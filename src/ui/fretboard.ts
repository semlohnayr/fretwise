import {
  type Interval, type Note, type Tuning, type CagedShape, type TriadVoicing,
  SCALES, CHORDS, TUNINGS, scaleById, chordById, scaleNotes, chordNotes, chordSymbol,
  noteName, pc, fretPc, isStandard, parseTuning, cagedShapes, triadVoicings,
  INVERSION_NAMES, intervalLabel, intervalName, tuningLabel,
} from '../theory';
import { getState, setState, type State, type FretMode } from '../state';
import { h, s, select, segmented } from './dom';
import { degreeClass, noteRow, rootPicker } from './controls';

const TRIAD_IDS = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'];
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];

/* ---------- Resolve state into something drawable ---------- */

interface Marked {
  note: Note;
  interval: Interval;
}

interface Resolved {
  title: string;
  /** Pitch class → spelled note + interval from the root. */
  marks: Map<number, Marked>;
  notes: Note[];
  intervals: Interval[];
  blurb: string;
  /** Triad quality for CAGED, if the selection has one. */
  cagedQuality?: 'major' | 'minor';
}

/** Major if it has a major 3rd, minor if a minor 3rd with a perfect 5th. Otherwise no CAGED. */
function qualityOf(intervals: Interval[]): 'major' | 'minor' | undefined {
  const has = (d: number, st: number) => intervals.some((i) => i.degree === d && i.semitones === st);
  if (has(3, 4) && has(5, 7)) return 'major';
  if (has(3, 3) && has(5, 7)) return 'minor';
  return undefined;
}

export function getTuning(st: State): { tuning: Tuning; error?: string } {
  if (st.tuningId !== 'custom') return { tuning: TUNINGS.find((t) => t.id === st.tuningId) ?? TUNINGS[0] };
  try {
    return { tuning: parseTuning(st.customTuning) };
  } catch (e) {
    return { tuning: TUNINGS[0], error: (e as Error).message };
  }
}

function resolve(st: State): Resolved {
  const build = (title: string, notes: Note[], intervals: Interval[], blurb: string): Resolved => {
    const marks = new Map<number, Marked>();
    notes.forEach((x, i) => {
      if (!marks.has(pc(x))) marks.set(pc(x), { note: x, interval: intervals[i] });
    });
    return { title, marks, notes, intervals, blurb, cagedQuality: qualityOf(intervals) };
  };

  if (st.fretMode === 'scale') {
    const scale = scaleById(st.scaleId);
    // Mode names are proper nouns (D Dorian); generic names are not (A minor pentatonic).
    const proper = scale.family === 'mode' && !scale.name.includes('(');
    const label = proper ? scale.name : scale.name[0].toLowerCase() + scale.name.slice(1);
    return build(`${noteName(st.root)} ${label}`, scaleNotes(st.root, scale), scale.formula, scale.blurb);
  }
  if (st.fretMode === 'chord' || st.fretMode === 'triads') {
    const chord = chordById(st.fretMode === 'triads' && !TRIAD_IDS.includes(st.chordId) ? 'maj' : st.chordId);
    return build(`${chordSymbol(st.root, chord)} (${chord.name.toLowerCase()})`, chordNotes(st.root, chord), chord.formula, chord.blurb);
  }
  // Notes mode: just the chosen note, everywhere.
  return build(
    `Every ${noteName(st.root)} on the neck`,
    [st.root],
    [{ degree: 1, semitones: 0 }],
    'Learn where each note lives: find it on every string, then use octave shapes (two strings and two frets over, or three strings and three frets over) to jump between them.',
  );
}

/* ---------- Geometry ---------- */

interface Geo {
  width: number;
  height: number;
  x: (fret: number) => number;
  /** Centre of the space behind a fret (where you put your finger). */
  cx: (fret: number) => number;
  y: (string: number) => number;
  boardTop: number;
  boardBottom: number;
  nutX: number;
}

function geometry(stringCount: number, frets: number): Geo {
  const openW = 46;
  const nutX = 20 + openW;
  const pad = 22;
  const gap = 34;
  // Gently tapered frets: real guitars shrink by 2^(-1/12) per fret; we halve the taper for legibility.
  const widths: number[] = [];
  let w = 78;
  for (let f = 1; f <= frets; f++) {
    widths.push(w);
    w *= Math.pow(2, -1 / 24);
  }
  const xs = [nutX];
  widths.forEach((ww) => xs.push(xs[xs.length - 1] + ww));
  const boardTop = pad + 6;
  const boardBottom = boardTop + gap * (stringCount - 1) + 24;
  return {
    width: xs[xs.length - 1] + 24,
    height: boardBottom + 34,
    x: (f) => xs[f],
    cx: (f) => (f === 0 ? nutX - openW / 2 - 4 : (xs[f - 1] + xs[f]) / 2),
    // Highest string drawn at the top, like tab.
    y: (st) => boardTop + 12 + gap * (stringCount - 1 - st),
    boardTop,
    boardBottom,
    nutX,
  };
}

/* ---------- Drawing ---------- */

function drawBoard(g: Geo, tn: Tuning, frets: number): SVGElement {
  const board = s('g', { class: 'board' });
  board.append(
    s('rect', { x: g.nutX, y: g.boardTop, width: g.x(frets) - g.nutX + 6, height: g.boardBottom - g.boardTop, class: 'wood', rx: 3 }),
  );
  const midY = (g.boardTop + g.boardBottom) / 2;
  for (const f of INLAYS.filter((f) => f <= frets)) board.append(s('circle', { cx: g.cx(f), cy: midY, r: 7, class: 'inlay' }));
  for (const f of DOUBLE_INLAYS.filter((f) => f <= frets)) {
    const off = (g.boardBottom - g.boardTop) / 4;
    board.append(s('circle', { cx: g.cx(f), cy: midY - off, r: 7, class: 'inlay' }));
    board.append(s('circle', { cx: g.cx(f), cy: midY + off, r: 7, class: 'inlay' }));
  }
  board.append(s('rect', { x: g.nutX - 6, y: g.boardTop - 2, width: 8, height: g.boardBottom - g.boardTop + 4, class: 'nut', rx: 2 }));
  for (let f = 1; f <= frets; f++) board.append(s('line', { x1: g.x(f), x2: g.x(f), y1: g.boardTop, y2: g.boardBottom, class: 'fret' }));
  tn.strings.forEach((open, i) => {
    // Lower strings are thicker.
    const width = 1 + (1.8 * (tn.strings.length - 1 - i)) / Math.max(1, tn.strings.length - 1);
    board.append(s('line', { x1: g.nutX - 46, x2: g.x(frets) + 6, y1: g.y(i), y2: g.y(i), class: `string ${i < tn.strings.length / 2 ? 'wound' : ''}`, 'stroke-width': width.toFixed(2) }));
    board.append(s('text', { x: 10, y: g.y(i) + 4, class: 'open-name' }, noteName(open)));
  });
  for (let f = 1; f <= frets; f++) {
    if ([...INLAYS, ...DOUBLE_INLAYS].includes(f) || f === 1) board.append(s('text', { x: g.cx(f), y: g.boardBottom + 20, class: 'fret-num' }, String(f)));
  }
  return board;
}

function dot(g: Geo, string: number, fret: number, m: Marked, st: State, extra = ''): SVGElement {
  const label = st.labels === 'names' ? noteName(m.note) : st.labels === 'intervals' ? intervalLabel(m.interval) : '';
  const el = s(
    'g',
    { class: `dot ${degreeClass(m.interval)} ${m.interval.degree === 1 ? 'root' : ''} ${extra}`, transform: `translate(${g.cx(fret)} ${g.y(string)})` },
    s('circle', { r: 13 }),
    label ? s('text', { y: 4.5, class: label.length > 2 ? 'small' : '' }, label) : null,
  );
  el.append(s('title', {}, `${noteName(m.note)}, ${intervalName(m.interval)} (string ${string + 1} from the bottom, fret ${fret})`));
  return el;
}

const CAGED_CLASS: Record<string, string> = { C: 'cg-c', A: 'cg-a', G: 'cg-g', E: 'cg-e', D: 'cg-d' };

function drawCaged(g: Geo, shapes: CagedShape[], focus: string): SVGElement {
  const layer = s('g', { class: 'caged-layer' });
  shapes.forEach((sh, i) => {
    if (focus !== 'all' && focus !== sh.name) return;
    const [lo, hi] = sh.window;
    const x0 = lo === 0 ? g.nutX - 44 : g.x(lo - 1) + 2;
    const x1 = g.x(hi) - 2;
    // Alternate band heights so overlapping neighbours stay readable.
    const inset = focus === 'all' ? (i % 2 ? 6 : 0) : 0;
    layer.append(
      s('rect', { x: x0, y: g.boardTop - 18 + inset, width: x1 - x0, height: g.boardBottom - g.boardTop + 36 - inset * 2, rx: 8, class: `caged-band ${CAGED_CLASS[sh.name]}` }),
      s('text', { x: (x0 + x1) / 2, y: g.boardTop - 6 + inset, class: `caged-label ${CAGED_CLASS[sh.name]}` }, `${sh.name} shape`),
    );
  });
  return layer;
}

function inWindow(sh: CagedShape, fret: number): boolean {
  return fret >= sh.window[0] && fret <= sh.window[1];
}

function drawTriads(g: Geo, voicings: TriadVoicing[], r: Resolved, st: State): SVGElement {
  const layer = s('g', { class: 'triads' });
  const marks = [...r.marks.values()];
  for (const v of voicings) {
    const pts = v.strings.map((str, i) => `${g.cx(v.frets[i])},${g.y(str)}`).join(' ');
    layer.append(s('polyline', { points: pts, class: `triad-line inv-${v.inversion}` }));
  }
  for (const v of voicings) {
    v.strings.forEach((str, i) => layer.append(dot(g, str, v.frets[i], marks[v.tones[i]], st)));
  }
  return layer;
}

/* ---------- Controls ---------- */

function controls(st: State, tn: Tuning, tuningError: string | undefined, r: Resolved): HTMLElement {
  const standard = isStandard(tn);
  const modeOpts: { value: FretMode; label: string }[] = [
    { value: 'scale', label: 'Scale' },
    { value: 'chord', label: 'Chord' },
    { value: 'triads', label: 'Triads' },
    { value: 'notes', label: 'Find a note' },
  ];
  const cagedOk = standard && !!r.cagedQuality && (st.fretMode === 'scale' || st.fretMode === 'chord');
  const cagedTitle = !standard ? 'CAGED is defined for standard tuning' : !r.cagedQuality ? 'CAGED needs a major or minor sound' : undefined;
  const stringSets = Array.from({ length: Math.max(0, tn.strings.length - 2) }, (_, i) => i);
  const num = (i: number) => tn.strings.length - i; // string numbers, 1 = highest

  return h(
    'div',
    { class: 'controls' },
    h('div', { class: 'control-row' }, rootPicker(st.root, (root) => setState({ root }))),
    h(
      'div',
      { class: 'control-row' },
      segmented('Show', st.fretMode, modeOpts, (fretMode) => setState({ fretMode })),
      st.fretMode === 'scale'
        ? select('Scale', st.scaleId, SCALES.map((x) => ({ value: x.id, label: x.name, group: { mode: 'Modes', minor: 'Minor scales', pentatonic: 'Pentatonic', blues: 'Blues' }[x.family] })), (scaleId) => setState({ scaleId }))
        : null,
      st.fretMode === 'chord'
        ? select('Chord', st.chordId, CHORDS.map((c) => ({ value: c.id, label: `${c.name} (${noteName(st.root)}${c.symbol})` })), (chordId) => setState({ chordId }))
        : null,
      st.fretMode === 'triads'
        ? select('Triad', TRIAD_IDS.includes(st.chordId) ? st.chordId : 'maj', CHORDS.filter((c) => TRIAD_IDS.includes(c.id)).map((c) => ({ value: c.id, label: c.name })), (chordId) => setState({ chordId }))
        : null,
      st.fretMode === 'triads'
        ? segmented('Strings', String(Math.min(st.triadSet, stringSets.length - 1)), stringSets.map((i) => ({ value: String(i), label: `${num(i)}-${num(i + 1)}-${num(i + 2)}` })), (v) => setState({ triadSet: Number(v) }))
        : null,
    ),
    h(
      'div',
      { class: 'control-row' },
      select('Tuning', st.tuningId, [...TUNINGS.map((t) => ({ value: t.id, label: t.name })), { value: 'custom', label: 'Custom…' }], (tuningId) => setState({ tuningId })),
      st.tuningId === 'custom'
        ? h(
            'label',
            { class: 'field' },
            h('span', {}, 'Strings, lowest first'),
            h('input', {
              type: 'text',
              value: st.customTuning,
              spellcheck: 'false',
              'aria-invalid': tuningError ? 'true' : 'false',
              onchange: (e: Event) => setState({ customTuning: (e.target as HTMLInputElement).value }),
            }),
            tuningError ? h('em', { class: 'error' }, tuningError) : null,
          )
        : null,
      select('Frets', String(st.frets), [12, 15, 17, 22, 24].map((f) => ({ value: String(f), label: String(f) })), (v) => setState({ frets: Number(v) })),
      segmented('Labels', st.labels, [{ value: 'intervals', label: 'Intervals' }, { value: 'names', label: 'Notes' }, { value: 'none', label: 'None' }], (labels) => setState({ labels })),
      st.fretMode === 'scale' || st.fretMode === 'chord'
        ? segmented(
            'CAGED',
            cagedOk ? st.caged : 'off',
            (['off', 'all', 'C', 'A', 'G', 'E', 'D'] as const).map((v) => ({
              value: v,
              label: v === 'off' ? 'Off' : v === 'all' ? 'All' : v,
              disabled: !cagedOk && v !== 'off',
              title: cagedTitle,
            })),
            (caged) => setState({ caged }),
          )
        : null,
    ),
  );
}

/* ---------- Info panel ---------- */

function info(st: State, r: Resolved, tn: Tuning, voicings: TriadVoicing[], cagedActive: boolean, shapes: CagedShape[]): HTMLElement {
  const parts: (HTMLElement | null)[] = [
    h('h2', {}, r.title),
    st.fretMode !== 'notes' ? noteRow(r.notes, r.intervals) : null,
    h('p', { class: 'prose' }, r.blurb),
  ];

  if (st.fretMode === 'triads') {
    const counts = [0, 1, 2].map((inv) => voicings.filter((v) => v.inversion === inv).length);
    parts.push(
      h('div', { class: 'prose' },
        h('p', {}, 'A triad on three adjacent strings can start on any of its three notes. With the root on the lowest string it is in root position; with the 3rd on the bottom it is in 1st inversion; with the 5th on the bottom, 2nd inversion. Climb the neck and the three shapes repeat in that cycle.'),
        h('p', {}, 'These small grips are how mandolin and guitar players comp up the neck and how a lead part can outline the chord changes.'),
      ),
      h('ul', { class: 'legend' }, ...[0, 1, 2].map((inv) => h('li', { class: `inv-${inv}` }, h('i', {}), `${INVERSION_NAMES[inv]} (${counts[inv]})`))),
    );
  }

  if (cagedActive) {
    const order = shapes.slice(0, 5).map((x) => x.name).join(' → ');
    parts.push(
      h('div', { class: 'prose' },
        h('p', {}, `CAGED links the five open chord shapes (C, A, G, E and D) into a chain that covers the whole neck. Moved up to ${noteName(st.root)}, they run ${order} from the nut upward, each sharing notes with the next.`),
        h('p', {}, st.fretMode === 'scale'
          ? 'Each coloured box is one scale position built around a chord shape. Learn the chord shape first, then the scale notes that surround it.'
          : 'Ringed notes are the chord grip itself. The other chord tones in the box are there to find alternative voicings.'),
      ),
    );
  }

  parts.push(
    h('p', { class: 'meta' }, `Tuning: ${tuningLabel(tn)}${isStandard(tn) ? '' : ' (non-standard)'}`),
    h('ul', { class: 'legend degrees' },
      ...['1', '2', '3', '4', '5', '6', '7'].map((d) => h('li', { class: `deg-${d}` }, h('i', {}), d === '1' ? 'Root' : `${d}${d === '2' ? 'nd' : d === '3' ? 'rd' : 'th'}${d === '2' ? ' or 9th' : d === '4' ? ' or 11th' : d === '6' ? ' or 13th' : ''}`)),
    ),
  );
  return h('div', { class: 'fret-info' }, ...parts);
}

/* ---------- Render ---------- */

export function renderFretboard(root: HTMLElement, st: State = getState()): void {
  const { tuning: tn, error } = getTuning(st);
  const r = resolve(st);
  const g = geometry(tn.strings.length, st.frets);

  const cagedActive = isStandard(tn) && !!r.cagedQuality && st.caged !== 'off' && (st.fretMode === 'scale' || st.fretMode === 'chord');
  const shapes = cagedActive ? cagedShapes(st.root, r.cagedQuality!, st.frets) : [];
  const focusShapes = cagedActive && st.caged !== 'all' ? shapes.filter((x) => x.name === st.caged) : [];

  const svg = s('svg', { viewBox: `0 0 ${g.width} ${g.height}`, width: g.width, height: g.height, class: 'fretboard', role: 'img', 'aria-label': `${r.title} on the fretboard` });
  svg.append(drawBoard(g, tn, st.frets));
  if (cagedActive) svg.append(drawCaged(g, shapes, st.caged));

  let voicings: TriadVoicing[] = [];
  if (st.fretMode === 'triads') {
    const set = Math.min(st.triadSet, tn.strings.length - 3);
    voicings = triadVoicings(tn, r.notes.map(pc), [set, set + 1, set + 2], st.frets);
    svg.append(drawTriads(g, voicings, r, st));
  } else {
    const dots = s('g', { class: 'dots' });
    // Grip frets for ringed chord tones when a single CAGED shape is focused.
    const grip = new Set<string>();
    if (st.fretMode === 'chord') focusShapes.forEach((sh) => sh.frets.forEach((f, i) => f !== null && grip.add(`${i}:${f}`)));
    tn.strings.forEach((_, str) => {
      for (let f = 0; f <= st.frets; f++) {
        const m = r.marks.get(fretPc(tn, str, f));
        if (!m) continue;
        let extra = '';
        if (focusShapes.length) extra = focusShapes.some((sh) => inWindow(sh, f)) ? '' : 'faded';
        if (grip.has(`${str}:${f}`)) extra += ' grip';
        dots.append(dot(g, str, f, m, st, extra));
      }
    });
    svg.append(dots);
  }

  root.replaceChildren(
    controls(st, tn, error, r),
    h('div', { class: 'neck-scroll', tabindex: '0', 'aria-label': 'Fretboard, scroll horizontally' }, svg),
    info(st, r, tn, voicings, cagedActive, shapes),
  );
}
