import {
  type Interval, type Note, type Tuning, type CagedShape, type TriadVoicing, type NpsPosition, type Voicing,
  SCALES, CHORDS, TUNINGS, scaleById, chordById, scaleNotes, chordNotes, chordSymbol,
  noteName, pc, fretPc, isStandard, parseTuning, cagedShapes, triadVoicings, threeNps,
  chordVoicings, voicingName, stringMidis,
  INVERSION_NAMES, intervalLabel, intervalName, tuningLabel,
} from '../theory';
import { getState, setState, type State, type FretMode, type Pattern } from '../state';
import { h, s, select, segmented, disclosure } from './dom';
import { degreeClass, noteRow, rootPicker, playButton } from './controls';
import { playNote, playChord, playSequence, playProgression, scaleMidis, chordMidis } from '../audio';
import { setTrack, guideTrack } from '../metronome';
import { markPos } from './highlight';

type GuideNote = { midi: number; pos: string };

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

function dot(g: Geo, string: number, fret: number, m: Marked, st: State, extra = '', midi?: number): SVGElement {
  const label = st.labels === 'names' ? noteName(m.note) : st.labels === 'intervals' ? intervalLabel(m.interval) : '';
  const el = s(
    'g',
    { class: `dot ${degreeClass(m.interval)} ${m.interval.degree === 1 ? 'root' : ''} ${extra}`, transform: `translate(${g.cx(fret)} ${g.y(string)})`, 'data-pos': `${string}:${fret}` },
    s('circle', { r: 13 }),
    label ? s('text', { y: 4.5, class: label.length > 2 ? 'small' : '' }, label) : null,
  );
  el.append(s('title', {}, `${noteName(m.note)}, ${intervalName(m.interval)} (string ${string + 1} from the bottom, fret ${fret})`));
  if (midi !== undefined) el.addEventListener('click', () => playNote(midi));
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
    // Alternate band heights so overlapping neighbors stay readable.
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

function drawTriads(g: Geo, voicings: TriadVoicing[], r: Resolved, st: State, opens: number[]): SVGElement {
  const layer = s('g', { class: 'triads' });
  const marks = [...r.marks.values()];
  for (const v of voicings) {
    const pts = v.strings.map((str, i) => `${g.cx(v.frets[i])},${g.y(str)}`).join(' ');
    const line = s('polyline', { points: pts, class: `triad-line inv-${v.inversion}` });
    // Clicking the connecting line strums that triad.
    line.addEventListener('click', () => playChord(v.strings.map((str, i) => opens[str] + v.frets[i])));
    layer.append(line);
  }
  for (const v of voicings) {
    v.strings.forEach((str, i) => layer.append(dot(g, str, v.frets[i], marks[v.tones[i]], st, '', opens[str] + v.frets[i])));
  }
  return layer;
}

function drawNps(g: Geo, pos: NpsPosition): SVGElement {
  const lo = pos.minFret;
  const hi = pos.maxFret;
  const x0 = lo === 0 ? g.nutX - 44 : g.x(lo - 1) + 2;
  const x1 = g.x(hi) - 2;
  return s(
    'g',
    { class: 'caged-layer' },
    s('rect', { x: x0, y: g.boardTop - 18, width: x1 - x0, height: g.boardBottom - g.boardTop + 36, rx: 8, class: 'caged-band nps-band' }),
    s('text', { x: (x0 + x1) / 2, y: g.boardTop - 6, class: 'caged-label' }, `Position ${pos.number}`),
  );
}

/* ---------- Chord diagrams ---------- */

function chordDiagram(v: Voicing, intervals: Interval[], strings: number): SVGElement {
  const fretted = v.frets.filter((f): f is number => f !== null && f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const start = maxF <= 5 ? 1 : v.baseFret;
  const rows = 5;
  const gap = 15;
  const left = 20;
  const top = 24;
  const w = left + gap * (strings - 1) + 18;
  const hgt = top + rows * 18 + 10;
  const x = (i: number) => left + gap * i;
  const y = (f: number) => top + (f - start + 0.5) * 18;
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, class: 'diagram', 'aria-hidden': 'true' });
  for (let r = 0; r <= rows; r++) svg.append(s('line', { x1: x(0), x2: x(strings - 1), y1: top + r * 18, y2: top + r * 18, class: r === 0 && start === 1 ? 'dg-nut' : 'dg-fret' }));
  for (let i = 0; i < strings; i++) svg.append(s('line', { x1: x(i), x2: x(i), y1: top, y2: top + rows * 18, class: 'dg-string' }));
  if (start > 1) svg.append(s('text', { x: 2, y: y(start) + 4, class: 'dg-base' }, `${start}`));
  if (v.barre) svg.append(s('rect', { x: x(v.barre.from) - 6, y: y(v.barre.fret) - 6, width: x(v.barre.to) - x(v.barre.from) + 12, height: 12, rx: 6, class: 'dg-barre' }));
  v.frets.forEach((f, i) => {
    if (f === null) svg.append(s('text', { x: x(i), y: top - 8, class: 'dg-mark' }, '×'));
    else if (f === 0) svg.append(s('circle', { cx: x(i), cy: top - 11, r: 4, class: 'dg-open' }));
    else {
      const iv = intervals[v.tones[i]!];
      svg.append(s('g', { class: `dg-dot ${degreeClass(iv)}` }, s('circle', { cx: x(i), cy: y(f), r: 6.5 })));
    }
  });
  return svg;
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
  const npsOk = st.fretMode === 'scale' && r.notes.length === 7;
  const pattern = effectivePattern(st, tn, r);
  const patternOpts: { value: Pattern; label: string; disabled?: boolean; title?: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'caged', label: 'CAGED', disabled: !cagedOk, title: cagedTitle },
  ];
  if (st.fretMode === 'scale') patternOpts.push({ value: '3nps', label: '3 per string', disabled: !npsOk, title: npsOk ? undefined : 'Needs a seven-note scale' });
  const stringSets = Array.from({ length: Math.max(0, tn.strings.length - 2) }, (_, i) => i);
  const num = (i: number) => tn.strings.length - i; // string numbers, 1 = highest

  const tuningName = st.tuningId === 'custom' ? `custom tuning (${tuningLabel(tn)})` : (TUNINGS.find((t) => t.id === st.tuningId)?.name ?? 'Standard').replace(/ \(.*\)$/, '').toLowerCase().replace(/^standard$/, 'standard tuning');
  const labelName = { intervals: 'interval labels', names: 'note-name labels', none: 'no labels' }[st.labels];

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
      st.fretMode === 'scale' || st.fretMode === 'chord'
        ? segmented('Pattern', pattern, patternOpts, (p) => setState({ pattern: p, voicing: null }))
        : null,
      pattern === 'caged'
        ? segmented('Shape', st.caged, (['all', 'C', 'A', 'G', 'E', 'D'] as const).map((v) => ({ value: v, label: v === 'all' ? 'All' : v })), (caged) => setState({ caged }))
        : null,
      pattern === '3nps'
        ? segmented('Position', String(st.npsPosition), [1, 2, 3, 4, 5, 6, 7].map((p) => ({ value: String(p), label: String(p) })), (v) => setState({ npsPosition: Number(v) }))
        : null,
    ),
    disclosure('fret-settings', 'Neck settings', `${tuningName[0].toUpperCase()}${tuningName.slice(1)}, ${st.frets} frets, ${labelName}`, [
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
      ),
    ]),
    tuningError ? h('p', { class: 'error' }, `Custom tuning: ${tuningError}. Showing standard tuning instead.`) : null,
  );
}

/* ---------- Info panel ---------- */

function info(st: State, r: Resolved, voicings: TriadVoicing[], cagedActive: boolean, shapes: CagedShape[], nps: NpsPosition | undefined, play: HTMLElement | null): HTMLElement {
  const explain: HTMLElement[] = [];
  if (st.fretMode === 'triads') {
    explain.push(
      h('p', {}, 'A triad on three adjacent strings can start on any of its three notes. With the root on the lowest string it is in root position; with the 3rd on the bottom it is in 1st inversion; with the 5th on the bottom, 2nd inversion. Climb the neck and the three shapes repeat in that cycle.'),
      h('p', {}, 'These small grips are how mandolin and guitar players comp up the neck and how a lead part can outline the chord changes.'),
    );
  }
  if (cagedActive) {
    const order = shapes.slice(0, 5).map((x) => x.name).join(' → ');
    explain.push(
      h('p', {}, `CAGED links the five open chord shapes (C, A, G, E and D) into a chain that covers the whole neck. Moved up to ${noteName(st.root)}, they run ${order} from the nut upward, each sharing notes with the next.`),
      h('p', {}, st.fretMode === 'scale'
        ? 'Each colored box is one scale position built around a chord shape. Learn the chord shape first, then the scale notes that surround it.'
        : 'Ringed notes are the chord grip itself. The other chord tones in the box are there to find alternative voicings.'),
    );
  }
  if (nps) {
    explain.push(
      h('p', {}, `Three notes on every string, starting from scale degree ${nps.number} on the lowest string. Seven positions, one per scale degree, tile the whole neck and overlap with their neighbors.`),
      h('p', {}, 'The even three-note groups make these patterns ideal for alternate picking and speed work: every string gets the same down-up-down (or up-down-up) motion.'),
    );
  }
  const topic = st.fretMode === 'triads' ? 'triad inversions' : cagedActive ? 'CAGED' : nps ? 'three notes per string' : '';
  const counts = [0, 1, 2].map((inv) => voicings.filter((v) => v.inversion === inv).length);

  return h(
    'div',
    { class: 'fret-info' },
    h('div', { class: 'title-row' }, h('h2', {}, r.title), play),
    st.fretMode !== 'notes' ? noteRow(r.notes, r.intervals) : null,
    h('p', { class: 'prose' }, r.blurb),
    st.fretMode === 'triads'
      ? h('ul', { class: 'legend' }, ...[0, 1, 2].map((inv) => h('li', { class: `inv-${inv}` }, h('i', {}), `${INVERSION_NAMES[inv]} (${counts[inv]})`)))
      : null,
    explain.length ? disclosure(`fret-explain-${topic}`, `How ${topic} works`, '', [h('div', { class: 'prose' }, ...explain)], 'info') : null,
  );
}

/** Color key for the dots, with the one thing to know about using the neck. */
function neckFoot(st: State): HTMLElement {
  return h(
    'div',
    { class: 'neck-foot' },
    st.fretMode === 'notes'
      ? h('span', {})
      : h('ul', { class: 'legend degrees', 'aria-label': 'Dot colors' },
        ...['1', '2', '3', '4', '5', '6', '7'].map((d) => h('li', { class: `deg-${d}` }, h('i', {}), d === '1' ? 'Root' : `${d}${d === '2' ? 'nd' : d === '3' ? 'rd' : 'th'}`))),
    h('span', { class: 'hint' }, st.fretMode === 'triads' ? 'Tap a note to hear it, or a line to strum the triad.' : 'Tap a note to hear it.'),
  );
}

/* ---------- Render ---------- */

export function renderFretboard(root: HTMLElement, st: State = getState()): void {
  const { tuning: tn, error } = getTuning(st);
  const r = resolve(st);
  const g = geometry(tn.strings.length, st.frets);

  const opens = stringMidis(tn);
  const pattern = effectivePattern(st, tn, r);
  const cagedActive = pattern === 'caged';
  const shapes = cagedActive ? cagedShapes(st.root, r.cagedQuality!, st.frets) : [];
  const focusShapes = cagedActive && st.caged !== 'all' ? shapes.filter((x) => x.name === st.caged) : [];
  const npsAll = pattern === '3nps' ? threeNps(tn, pc(st.root), r.intervals.map((i) => i.semitones), st.frets) : [];
  const nps = npsAll.find((p) => p.number === st.npsPosition);
  const npsSet = new Set<string>();
  nps?.frets.forEach((fs, str) => fs.forEach((f) => npsSet.add(`${str}:${f}`)));

  // Chord voicings (chord mode only).
  const library = st.fretMode === 'chord' ? chordVoicings(tn, r.notes.map(pc), { maxFret: Math.min(st.frets, 17) }) : [];
  const chosen = library.find((v) => voicingName(v) === st.voicing);

  const svg = s('svg', { viewBox: `0 0 ${g.width} ${g.height}`, width: g.width, height: g.height, class: 'fretboard', role: 'img', 'aria-label': `${r.title} on the fretboard` });
  svg.append(drawBoard(g, tn, st.frets));
  if (cagedActive) svg.append(drawCaged(g, shapes, st.caged));
  if (nps) svg.append(drawNps(g, nps));

  let voicings: TriadVoicing[] = [];
  if (st.fretMode === 'triads') {
    const set = Math.min(st.triadSet, tn.strings.length - 3);
    voicings = triadVoicings(tn, r.notes.map(pc), [set, set + 1, set + 2], st.frets);
    svg.append(drawTriads(g, voicings, r, st, opens));
  } else {
    const dots = s('g', { class: 'dots' });
    // Grip frets for ringed chord tones when a single CAGED shape is focused.
    const grip = new Set<string>();
    if (st.fretMode === 'chord') focusShapes.forEach((sh) => sh.frets.forEach((f, i) => f !== null && grip.add(`${i}:${f}`)));
    const chosenSet = new Set<string>();
    chosen?.frets.forEach((f, i) => f !== null && chosenSet.add(`${i}:${f}`));
    tn.strings.forEach((_, str) => {
      for (let f = 0; f <= st.frets; f++) {
        const m = r.marks.get(fretPc(tn, str, f));
        if (!m) continue;
        const key = `${str}:${f}`;
        let extra = '';
        if (chosen) extra = chosenSet.has(key) ? 'grip' : 'faded';
        else {
          if (focusShapes.length) extra = focusShapes.some((sh) => inWindow(sh, f)) ? '' : 'faded';
          if (nps) extra = npsSet.has(key) ? '' : 'faded';
          if (grip.has(key)) extra += ' grip';
        }
        dots.append(dot(g, str, f, m, st, extra, opens[str] + f));
      }
    });
    svg.append(dots);
  }

  // Play-along notes for the metronome: the highlighted scale position, low to high.
  let guide: GuideNote[] | null = null;
  let guideLabel = '';
  if (st.fretMode === 'scale' && nps) {
    guide = nps.frets.flatMap((fs, str) => fs.map((f) => ({ midi: opens[str] + f, pos: `${str}:${f}` })));
    guideLabel = `${r.title}, position ${nps.number}`;
  } else if (st.fretMode === 'scale' && focusShapes.length === 1) {
    const sh = focusShapes[0];
    const seen = new Set<number>();
    const notes: GuideNote[] = [];
    tn.strings.forEach((_, str) => {
      for (let f = sh.window[0]; f <= sh.window[1]; f++) {
        const midi = opens[str] + f;
        if (r.marks.has(fretPc(tn, str, f)) && !seen.has(midi)) {
          seen.add(midi);
          notes.push({ midi, pos: `${str}:${f}` });
        }
      }
    });
    guide = notes.sort((a, b) => a.midi - b.midi);
    guideLabel = `${r.title}, ${sh.name} shape`;
  }
  setTrack(guide && guide.length ? guideTrack(guide, guideLabel, markPos) : null);

  // What the play button plays depends on what is highlighted.
  const semis = r.intervals.map((i) => i.semitones);
  let play: HTMLElement | null = null;
  if (st.fretMode === 'scale') {
    const focused = nps
      ? nps.frets.flatMap((fs, str) => fs.map((f) => opens[str] + f))
      : focusShapes.length
        ? positionsIn(tn, r, opens, st.frets, (f) => focusShapes.some((sh) => inWindow(sh, f)))
        : null;
    play = playButton(focused ? 'Play this position' : 'Play scale', () => {
      const run = focused ?? scaleMidis(pc(st.root), semis);
      playSequence([...run, ...[...run].reverse().slice(1)], 0.22);
    });
  } else if (st.fretMode === 'chord') {
    const grip = chosen ?? (focusShapes[0] ? { frets: focusShapes[0].frets } : library[0]);
    play = playButton('Strum', () =>
      playChord(grip ? grip.frets.flatMap((f, i) => (f === null ? [] : [opens[i] + f])) : chordMidis(pc(st.root), semis)),
    );
  } else if (st.fretMode === 'triads') {
    play = playButton('Play every inversion', () =>
      playProgression(voicings.map((v) => v.strings.map((str, i) => opens[str] + v.frets[i])), 0.7),
    );
  }

  root.replaceChildren(
    controls(st, tn, error, r),
    h('div', { class: 'neck-scroll', tabindex: '0', 'aria-label': 'Fretboard, scroll horizontally' }, svg),
    neckFoot(st),
    info(st, r, voicings, cagedActive, shapes, nps, play),
    ...(st.fretMode === 'chord' ? [voicingLibrary(r, tn, library, chosen, opens)] : []),
  );
}

/** Pattern actually in effect: falls back to none when the selection can't use it. */
function effectivePattern(st: State, tn: Tuning, r: Resolved): Pattern {
  if (st.fretMode !== 'scale' && st.fretMode !== 'chord') return 'none';
  if (st.pattern === 'caged') return isStandard(tn) && r.cagedQuality ? 'caged' : 'none';
  if (st.pattern === '3nps') return st.fretMode === 'scale' && r.notes.length === 7 ? '3nps' : 'none';
  return 'none';
}

/** Pitches of all marked notes inside a fret window, low to high, without repeats. */
function positionsIn(tn: Tuning, r: Resolved, opens: number[], frets: number, inside: (f: number) => boolean): number[] {
  const out = new Set<number>();
  tn.strings.forEach((_, str) => {
    for (let f = 0; f <= frets; f++) if (inside(f) && r.marks.has(fretPc(tn, str, f))) out.add(opens[str] + f);
  });
  return [...out].sort((a, b) => a - b);
}

function voicingLibrary(r: Resolved, tn: Tuning, library: Voicing[], chosen: Voicing | undefined, opens: number[]): HTMLElement {
  if (!library.length) {
    return h('section', { class: 'voicings' }, h('h3', {}, 'Voicings'), h('p', { class: 'hint' }, 'No playable root-position shapes in this tuning. Try another tuning or a simpler chord.'));
  }
  return h(
    'section',
    { class: 'voicings' },
    h('div', { class: 'h3-row' },
      h('h3', {}, `Voicings (${library.length})`),
      chosen ? h('button', { type: 'button', class: 'chip', onclick: () => setState({ voicing: null }) }, 'Show all chord tones') : null),
    h('p', { class: 'hint' }, 'Root in the bass. Tap one to hear it and see it on the neck.'),
    h(
      'ol',
      { class: 'voicing-grid' },
      ...library.map((v) => {
        const name = voicingName(v);
        const on = chosen && voicingName(chosen) === name;
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: on ? 'on' : '',
              'aria-pressed': String(!!on),
              'aria-label': `${name}${v.omitsFifth ? ', no 5th' : ''}`,
              onclick: () => {
                playChord(v.frets.flatMap((f, i) => (f === null ? [] : [opens[i] + f])));
                setState({ voicing: name, pattern: 'none' });
              },
            },
            chordDiagram(v, r.intervals, tn.strings.length),
            h('span', { class: 'tab' }, name),
            v.omitsFifth ? h('small', {}, 'no 5th') : null,
          ),
        );
      }),
    ),
  );
}

export interface NeckMark {
  string: number;
  fret: number;
  cls: string;
  label?: string;
}

/** A plain neck with arbitrary marks, used by the practice quizzes. */
export function neckSvg(tn: Tuning, frets: number, marks: NeckMark[], capo = 0): SVGElement {
  const g = geometry(tn.strings.length, frets);
  const svg = s('svg', { viewBox: `0 0 ${g.width} ${g.height}`, width: g.width, height: g.height, class: 'fretboard', role: 'img', 'aria-label': 'Fretboard' });
  svg.append(drawBoard(g, tn, frets));
  if (capo > 0) {
    // The capo sits just behind its fret wire.
    svg.append(s('rect', { x: g.x(capo) - 9, y: g.boardTop - 6, width: 10, height: g.boardBottom - g.boardTop + 12, rx: 4, class: 'capo-bar' }));
  }
  for (const m of marks) {
    svg.append(
      s('g', { class: `dot ${m.cls}`, transform: `translate(${g.cx(m.fret)} ${g.y(m.string)})`, 'data-pos': `${m.string}:${m.fret}` },
        s('circle', { r: 13 }),
        m.label ? s('text', { y: 4.5, class: m.label.length > 2 ? 'small' : '' }, m.label) : null),
    );
  }
  return svg;
}
