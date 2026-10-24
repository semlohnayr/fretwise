import {
  type Note, n, noteName, pc, SHAPE_KEYS, capoOptions, translateCapo, keyLabel, keySignature, relativeMajor,
} from '../theory';
import { getState, setState, type State } from '../state';
import { h, select, segmented, pageTitle } from './dom';
import { rootPicker, playButton } from './controls';
import { playChord, chordMidis } from '../audio';
import type { DiatonicChord } from '../theory';

const midisOf = (c: DiatonicChord, transpose = 0): number[] =>
  chordMidis(pc(c.root) + transpose, c.chord ? c.chord.formula.map((i) => i.semitones) : [0, 4, 7]);

function sigText(root: Note, quality: 'major' | 'minor'): string {
  const sig = keySignature(quality === 'major' ? root : relativeMajor(root));
  return sig.sharps ? `${sig.sharps}♯` : sig.flats ? `${sig.flats}♭` : 'no sharps or flats';
}

/** Section 1: the song is in key X; which open shapes and capo frets get you there? */
function finder(st: State): HTMLElement {
  const options = capoOptions(st.capoTarget, st.capoQuality);
  const target = keyLabel(st.capoTarget, st.capoQuality);
  return h(
    'section',
    { class: 'capo-finder' },
    h('h3', { class: 'section-title' }, 'Find a capo position'),
    h('p', { class: 'lead' }, `Pick the key you need to sound in, such as a singer's key. Each card is an open-chord key you know and the fret to put the capo on.`),
    h(
      'div',
      { class: 'controls' },
      h('div', { class: 'control-row' }, rootPicker(st.capoTarget, (capoTarget) => setState({ capoTarget }), 'Sounding key')),
      h('div', { class: 'control-row' },
        segmented('Quality', st.capoQuality, [{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }], (capoQuality) =>
          setState({ capoQuality, capoShape: capoQuality === 'major' ? 'G' : 'Em' }))),
    ),
    h(
      'ol',
      { class: 'capo-cards' },
      ...options.map((o) => {
        const shapeName = keyLabel(o.shape, st.capoQuality);
        const t = translateCapo(o.shape, st.capoQuality, o.capo);
        const prog = [0, 3, 4].map((i) => t.pairs[i]);
        return h(
          'li',
          { class: o.practical ? '' : 'impractical' },
          h(
            'button',
            { type: 'button', onclick: () => setState({ capoShape: shapeName, capoFret: o.capo }), 'aria-label': `Capo ${o.capo}, ${shapeName} shapes. Show the full translation.` },
            h('span', { class: 'capo-fret' }, o.capo === 0 ? 'No capo' : `Capo ${o.capo}`),
            h('b', {}, `${shapeName} shapes`),
            h('small', {}, prog.map((p) => `${p.shape.symbol}→${p.sounds.symbol}`).join('  ')),
            o.practical ? null : h('em', {}, 'High up the neck; sounds thin'),
          ),
        );
      }),
    ),
    h('p', { class: 'hint' }, `Every card sounds in ${target}. Select one to see every chord translated.`),
  );
}

/** Section 2: shapes + capo → what actually sounds, chord by chord. */
function translator(st: State): HTMLElement {
  const shapes = st.capoQuality === 'major' ? SHAPE_KEYS.major : SHAPE_KEYS.minor;
  const shapeName = (shapes as readonly string[]).includes(st.capoShape) ? st.capoShape : shapes[0];
  const shapeRoot = n(shapeName.replace('m', ''));
  const t = translateCapo(shapeRoot, st.capoQuality, st.capoFret);
  const soundingName = keyLabel(t.sounding, st.capoQuality);

  return h(
    'section',
    { class: 'capo-translate' },
    h('h3', { class: 'section-title' }, 'Translate chord shapes'),
    h(
      'div',
      { class: 'controls' },
      h('div', { class: 'control-row' },
        select('I’m playing shapes in', shapeName, shapes.map((x) => ({ value: x, label: x })), (capoShape) => setState({ capoShape })),
        select('Capo on fret', String(st.capoFret), Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: i === 0 ? 'No capo' : String(i) })), (v) => setState({ capoFret: Number(v) })),
      ),
    ),
    h('p', { class: 'capo-result' },
      'It sounds in ', h('b', {}, `${noteName(t.sounding)} ${st.capoQuality}`),
      ` (${sigText(t.sounding, st.capoQuality)}).`),
    h(
      'table',
      { class: 'capo-table' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Degree'), h('th', { scope: 'col' }, 'You finger'), h('th', { scope: 'col' }, 'It sounds as'), h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Play')))),
      h(
        'tbody',
        {},
        ...t.pairs.map((p) =>
          h('tr', {},
            h('td', { class: 'roman' }, p.shape.roman),
            h('td', {}, p.shape.symbol),
            h('td', {}, h('b', {}, p.sounds.symbol)),
            h('td', {}, playButton('', () => playChord(midisOf(p.shape, st.capoFret)), 'mini inline'))),
        ),
      ),
    ),
    h('p', { class: 'hint' }, `The play buttons sound at concert pitch, as the capoed guitar would. To go the other way, read the table backwards: a chart in ${soundingName} can be played with ${shapeName} shapes and the capo on ${st.capoFret === 0 ? 'no fret' : `fret ${st.capoFret}`}.`),
  );
}

function explainer(): HTMLElement {
  const sec = (title: string, ...paras: string[]) =>
    h('details', {}, h('summary', {}, title), h('div', { class: 'prose' }, ...paras.map((p) => h('p', {}, p))));
  return h(
    'section',
    { class: 'explainer' },
    h('h2', {}, 'How a capo works'),
    sec('Each fret is a half step', 'A capo shortens every string by the same amount, so everything you play goes up one half step per fret. G shapes with the capo on 2 sound in A, because A is two half steps above G.'),
    sec('Why players use one', 'Open-position shapes ring with open strings, which is a big part of the acoustic and bluegrass sound. A capo keeps those shapes and their ringing open strings while moving the song to a key that suits the singer or the fiddle player.', 'It is also how two guitars can play the same song with different voicings: one in G shapes at fret 2, the other in C shapes at fret 7, both sounding in A.'),
    sec('Reading a chart', 'If a chart says "capo 3, G shapes", the song sounds in B♭. Use the translator to see what to tell a bass player or a piano player, who think in the sounding key.'),
  );
}

export function renderCapo(root: HTMLElement, st: State = getState()): void {
  root.replaceChildren(pageTitle('Capo', 'Find where to put the capo for any key, and what your chord shapes sound like there.'), h('div', { class: 'capo-layout' }, finder(st), translator(st)), explainer());
}
