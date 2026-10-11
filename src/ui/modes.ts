import {
  type Interval, type ModeInfo, MODES, modeById, scaleById, scaleNotes, parentMajor, harmonize,
  noteName, intervalLabel, relativeMinor, pc,
} from '../theory';
import { getState, setState, type State } from '../state';
import { h, segmented, disclosure } from './dom';
import { degreeClass, noteRow, rootPicker, playButton } from './controls';
import { playScaleWithDrone, scaleMidis } from '../audio';

let order: 'degree' | 'brightness' = 'brightness';

const CHROMATIC = ['1', '♭2', '2', '♭3', '3', '4', '♯4/♭5', '5', '♭6', '6', '♭7', '7'];

function currentMode(st: State): ModeInfo {
  return MODES.find((m) => m.id === st.scaleId) ?? MODES[0];
}

function sortedModes(): ModeInfo[] {
  return [...MODES].sort((a, b) => (order === 'brightness' ? a.brightness - b.brightness : a.degree - b.degree));
}

function isCharacteristic(mode: ModeInfo, i: Interval): boolean {
  return intervalLabel(i) === mode.characteristic;
}

/** Parallel view: every mode on the same root, laid against a chromatic ruler. */
function parallelGrid(st: State, selected: ModeInfo): HTMLElement {
  const table = h('table', { class: 'mode-grid parallel' });
  table.append(
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Mode'), ...CHROMATIC.map((c) => h('th', { scope: 'col' }, c)))),
  );
  const body = h('tbody', {});
  for (const mode of sortedModes()) {
    const scale = scaleById(mode.id);
    const notes = scaleNotes(st.root, scale);
    const cells = CHROMATIC.map((_, semis) => {
      const idx = scale.formula.findIndex((i) => i.semitones === semis);
      if (idx < 0) return h('td', { class: 'empty' });
      const iv = scale.formula[idx];
      const tag = isCharacteristic(mode, iv) ? 'char' : '';
      return h('td', { class: `${degreeClass(iv)} ${tag}`, title: tag ? 'Characteristic note' : undefined }, noteName(notes[idx]));
    });
    body.append(
      h(
        'tr',
        { class: mode.id === selected.id ? 'selected' : '' },
        h('th', { scope: 'row' }, h('button', { type: 'button', onclick: () => setState({ scaleId: mode.id }) }, `${noteName(st.root)} ${mode.name}`)),
        ...cells,
      ),
    );
  }
  table.append(body);
  return h('div', { class: 'grid-scroll' }, table);
}

/** Relative view: the seven modes of one parent major scale. */
function relativeGrid(st: State, selected: ModeInfo): HTMLElement {
  const parent = parentMajor(st.root, selected.id);
  const parentNotes = scaleNotes(parent, scaleById('ionian'));
  const table = h('table', { class: 'mode-grid relative' });
  table.append(h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Mode'), ...[1, 2, 3, 4, 5, 6, 7].map((d) => h('th', { scope: 'col' }, `Note ${d}`)))));
  const body = h('tbody', {});
  for (const mode of sortedModes()) {
    const modeRoot = parentNotes[mode.degree - 1];
    const scale = scaleById(mode.id);
    const notes = scaleNotes(modeRoot, scale);
    body.append(
      h(
        'tr',
        { class: mode.id === selected.id ? 'selected' : '' },
        h('th', { scope: 'row' }, h('button', { type: 'button', onclick: () => setState({ root: modeRoot, scaleId: mode.id }) }, `${noteName(modeRoot)} ${mode.name}`)),
        ...notes.map((x, i) => {
          const iv = scale.formula[i];
          const tag = isCharacteristic(mode, iv) ? 'char' : '';
          return h('td', { class: `${degreeClass(iv)} ${tag}` }, h('b', {}, noteName(x)), h('small', {}, intervalLabel(iv)));
        }),
      ),
    );
  }
  table.append(body);
  return h('div', { class: 'grid-scroll' }, table);
}

function detail(st: State, mode: ModeInfo): HTMLElement {
  const scale = scaleById(mode.id);
  const notes = scaleNotes(st.root, scale);
  const parent = parentMajor(st.root, mode.id);
  const chords = harmonize(st.root, scale);
  const neighbor = mode.brightness > 1 ? MODES.find((m) => m.brightness === mode.brightness - 1) : undefined;
  return h(
    'article',
    { class: 'mode-detail' },
    h('div', { class: 'title-row' },
      h('h2', {}, `${noteName(st.root)} ${mode.name}`),
      playButton('Play over a drone', () => playScaleWithDrone(scaleMidis(pc(st.root), scale.formula.map((i) => i.semitones)), 0.34))),
    noteRow(notes, scale.formula),
    h(
      'div',
      { class: 'prose' },
      h('p', {}, mode.feel),
      h('p', {}, `Characteristic note: the ${mode.characteristic}. ${mode.quality === 'major' ? 'Compared with plain major' : mode.quality === 'minor' ? 'Compared with natural minor' : 'Compared with Phrygian'}, this is the note to lean on so the mode is heard.`),
    ),
    disclosure(`mode-more-${mode.id}`, `More about ${mode.name}`, 'harmony, where you hear it', [
      h('div', { class: 'prose' },
        h('p', {}, h('b', {}, 'Harmony. '), mode.harmony),
        h('p', {}, h('b', {}, 'Where you hear it. '), mode.examples),
        neighbor ? h('p', {}, `One step brighter is ${neighbor.name}: raise one note of ${mode.name} by a half step and you get there.`) : h('p', {}, 'Nothing is brighter than Lydian: every note sits as high as it can while keeping a perfect 5th.'),
        h('p', {}, `Same notes as ${noteName(parent)} major (and ${noteName(relativeMinor(parent))} minor), but centered on ${noteName(st.root)}.`)),
    ], 'info'),
    h('h3', {}, 'Chords of the mode'),
    h(
      'ol',
      { class: 'diatonic compact' },
      ...chords.map((c) =>
        h('li', {}, h('button', { type: 'button', onclick: () => c.chord && setState({ view: 'fretboard', fretMode: 'chord', root: c.root, chordId: c.chord.id }) },
          h('span', { class: 'roman' }, c.roman), h('b', {}, c.symbol))),
      ),
    ),
    h(
      'div',
      { class: 'chip-row' },
      h('button', { type: 'button', class: 'chip strong', onclick: () => setState({ view: 'fretboard', fretMode: 'scale', scaleId: mode.id }) }, 'Show on fretboard'),
      h('button', { type: 'button', class: 'chip', onclick: () => setState({ view: 'circle', root: parent, keyQuality: 'major', scaleId: 'ionian' }) }, `Open ${noteName(parent)} major on the circle`),
    ),
  );
}

function explainer(): HTMLElement {
  const sec = (title: string, ...paras: string[]) =>
    h('details', {}, h('summary', {}, title), h('div', { class: 'prose' }, ...paras.map((p) => h('p', {}, p))));
  return h(
    'section',
    { class: 'explainer' },
    h('h2', {}, 'Understanding modes'),
    sec(
      'What a mode is',
      'A mode is a scale heard from a different home note. Play C major from D to D and every note is the same, but the sound centers on D and becomes D Dorian.',
      'What changes is the set of intervals above the root. That pattern of whole and half steps is what gives each mode its character.',
    ),
    sec(
      'Relative versus parallel',
      'Relative thinking (one parent scale, seven starting points) is how modes are usually introduced and why they share fingerings: D Dorian and C major use the same notes on the neck.',
      'Parallel thinking (one root, seven modes) is how they are heard and used. Comparing G Ionian, G Mixolydian and G Dorian over the same G drone shows exactly which notes change the mood. Switch views above to compare.',
    ),
    sec(
      'Brightest to darkest',
      'Sorted by brightness, each mode lowers exactly one note of the mode before it: Lydian lowers its ♯4 to become Ionian, Ionian lowers its 7 to become Mixolydian, then the 3 (Dorian), the 6 (Aeolian), the 2 (Phrygian) and finally the 5 (Locrian).',
      'That makes the grid above a ladder: read it top to bottom and watch one note at a time step down.',
    ),
    sec(
      'Hearing a mode',
      'Modes only sound like themselves against a stable root. Hold a drone or loop a single chord on the root, then play the scale and linger on the characteristic note. Without the drone, your ear will drift back to the parent major key.',
      'On guitar an open-string drone is easiest: E, A, D and G modes can all ring against an open bass string.',
    ),
    sec(
      'Modes over chords',
      'In practice, players pick a mode to fit a chord: Mixolydian over a dominant 7th, Dorian over a minor 7th that acts as ii or as a one-chord vamp, Lydian over a major 7th that is the IV chord, Locrian over m7♭5.',
    ),
  );
}

export function renderModes(root: HTMLElement, st: State = getState()): void {
  const mode = currentMode(st);
  const parent = parentMajor(st.root, mode.id);
  const pickRoot =
    st.modesView === 'parallel'
      ? rootPicker(st.root, (r) => setState({ root: r }), 'Root')
      : rootPicker(parent, (p) => setState({ root: scaleNotes(p, scaleById('ionian'))[modeById(mode.id).degree - 1] }), 'Parent major key');

  root.replaceChildren(
    h(
      'div',
      { class: 'controls' },
      h('div', { class: 'control-row' }, pickRoot),
      h(
        'div',
        { class: 'control-row' },
        segmented('Compare', st.modesView, [{ value: 'parallel', label: 'Same root (parallel)' }, { value: 'relative', label: 'Same notes (relative)' }], (modesView) => setState({ modesView })),
        segmented('Order', order, [{ value: 'brightness', label: 'Brightest first' }, { value: 'degree', label: 'Major-scale order' }], (v) => { order = v; setState({}); }),
      ),
    ),
    h(
      'div',
      { class: 'modes-layout' },
      h('div', {}, st.modesView === 'parallel' ? parallelGrid(st, mode) : relativeGrid(st, mode), h('p', { class: 'hint' }, 'Outlined notes are each mode’s characteristic note. Select a mode to read about it.')),
      detail(st, mode),
    ),
    explainer(),
  );
}
