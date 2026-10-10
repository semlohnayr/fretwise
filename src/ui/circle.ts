import {
  CIRCLE, type CircleSlot, type Note, noteName, pc, keySignature, relativeMajor, relativeMinor,
  harmonize, scaleById, scaleNotes, MAJOR_PROGRESSIONS, MINOR_PROGRESSIONS, progressionChords, mod,
} from '../theory';
import { getState, setState, type State } from '../state';
import { h, s, clickable } from './dom';
import { noteRow, playButton } from './controls';
import { playChord, playProgression, playSequence, chordMidis, scaleMidis } from '../audio';
import type { DiatonicChord } from '../theory';

let showSevenths = false;

const CX = 300;
const CY = 300;
const RINGS = { major: [292, 214], minor: [214, 152], dim: [152, 112] } as const;

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function wedge(rOuter: number, rInner: number, index: number): string {
  const a0 = index * 30 - 15;
  const a1 = index * 30 + 15;
  const [x0, y0] = polar(rOuter, a0);
  const [x1, y1] = polar(rOuter, a1);
  const [x2, y2] = polar(rInner, a1);
  const [x3, y3] = polar(rInner, a0);
  return `M${x0},${y0} A${rOuter},${rOuter} 0 0 1 ${x1},${y1} L${x2},${y2} A${rInner},${rInner} 0 0 0 ${x3},${y3} Z`;
}

/** Which circle slot holds the current key's relative major. */
function tonicSlot(st: State): number {
  const major = st.keyQuality === 'major' ? st.root : relativeMajor(st.root);
  return CIRCLE.findIndex((c) => pc(c.major) === pc(major));
}

/** Roman numerals for the highlighted family, keyed by ring and offset from the tonic slot. */
function familyNumeral(ring: 'major' | 'minor' | 'dim', offset: number, quality: 'major' | 'minor'): string | null {
  const major: Record<string, string> = { 'major:-1': 'IV', 'major:0': 'I', 'major:1': 'V', 'minor:-1': 'ii', 'minor:0': 'vi', 'minor:1': 'iii', 'dim:0': 'vii°' };
  const minor: Record<string, string> = { 'major:-1': '♭VI', 'major:0': '♭III', 'major:1': '♭VII', 'minor:-1': 'iv', 'minor:0': 'i', 'minor:1': 'v', 'dim:0': 'ii°' };
  return (quality === 'major' ? major : minor)[`${ring}:${offset}`] ?? null;
}

function ringLabel(slot: CircleSlot, ring: 'major' | 'minor' | 'dim'): string {
  if (ring === 'major') return noteName(slot.major) + (slot.altMajor ? `/${noteName(slot.altMajor)}` : '');
  if (ring === 'minor') return noteName(slot.minor) + 'm' + (slot.altMinor ? `/${noteName(slot.altMinor)}m` : '');
  return noteName(slot.dim) + '°';
}

function circleSvg(st: State): SVGElement {
  const tonic = tonicSlot(st);
  const svg = s('svg', { viewBox: '-26 -26 652 652', class: 'circle', role: 'group', 'aria-label': 'Circle of fifths' });

  for (const ring of ['major', 'minor', 'dim'] as const) {
    const [ro, ri] = RINGS[ring];
    const mid = (ro + ri) / 2;
    for (const slot of CIRCLE) {
      const offset = mod(slot.index - tonic + 6, 12) - 6;
      const numeral = Math.abs(offset) <= 1 ? familyNumeral(ring, offset, st.keyQuality) : null;
      const isTonic =
        (st.keyQuality === 'major' && ring === 'major' && offset === 0) ||
        (st.keyQuality === 'minor' && ring === 'minor' && offset === 0);
      const cls = ['seg', `ring-${ring}`, numeral ? 'in-key' : '', isTonic ? 'tonic' : ''].join(' ');
      const g = s('g', { class: cls });
      g.append(s('path', { d: wedge(ro, ri, slot.index) }));

      const [tx, ty] = polar(mid, slot.index * 30);
      const label = ringLabel(slot, ring);
      const long = label.includes('/');
      g.append(
        s('text', { x: tx, y: ty + (numeral ? -6 : 1), class: `seg-label ${long ? 'long' : ''}` }, label),
      );
      if (numeral) g.append(s('text', { x: tx, y: ty + 13, class: 'seg-roman' }, numeral));
      if (ring === 'major') {
        const sig = keySignature(slot.major);
        const [kx, ky] = polar(ro + 14, slot.index * 30);
        g.append(s('text', { x: kx, y: ky + 4, class: 'seg-sig' }, sig.sharps ? `${sig.sharps}♯` : sig.flats ? `${sig.flats}♭` : '–'));
      }

      if (ring !== 'dim') {
        const target: Note = ring === 'major' ? slot.major : slot.minor;
        clickable(g, `${noteName(target)} ${ring}`, () =>
          setState({ root: target, keyQuality: ring, scaleId: ring === 'major' ? 'ionian' : 'aeolian' }),
        );
      }
      svg.append(g);
    }
  }

  // Centre: the selected key.
  const sig = keySignature(st.keyQuality === 'major' ? st.root : relativeMajor(st.root));
  svg.append(s('circle', { cx: CX, cy: CY, r: RINGS.dim[1] - 4, class: 'hub' }));
  svg.append(s('text', { x: CX, y: CY - 8, class: 'hub-key' }, `${noteName(st.root)}${st.keyQuality === 'minor' ? 'm' : ''}`));
  svg.append(
    s('text', { x: CX, y: CY + 22, class: 'hub-sig' }, sig.sharps ? `${sig.sharps} sharp${sig.sharps > 1 ? 's' : ''}` : sig.flats ? `${sig.flats} flat${sig.flats > 1 ? 's' : ''}` : 'no sharps or flats'),
  );
  return svg;
}

function keyPanel(st: State): HTMLElement {
  const isMajor = st.keyQuality === 'major';
  const scale = scaleById(isMajor ? 'ionian' : 'aeolian');
  const notes = scaleNotes(st.root, scale);
  const sig = keySignature(isMajor ? st.root : relativeMajor(st.root));
  const relative = isMajor ? relativeMinor(st.root) : relativeMajor(st.root);
  const slot = CIRCLE[tonicSlot(st)];
  // Keys at the bottom of the circle have two common spellings; offer the other one.
  const pair = isMajor ? [slot.major, slot.altMajor] : [slot.minor, slot.altMinor];
  const enharmonic = pair[1] ? pair.find((x) => x && noteName(x) !== noteName(st.root)) : undefined;

  const chords = harmonize(st.root, scale, showSevenths);
  const progressions = isMajor ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
  const openChord = (root: Note, chordId: string) => setState({ view: 'fretboard', root, chordId, fretMode: 'chord' });

  return h(
    'div',
    { class: 'key-panel' },
    h('h2', {}, `${noteName(st.root)} ${isMajor ? 'major' : 'minor'}`),
    h(
      'p',
      { class: 'sig-line' },
      sig.accidentals.length ? `Key signature: ${sig.accidentals.join(' ')}` : 'Key signature: no sharps or flats',
    ),
    h(
      'div',
      { class: 'chip-row' },
      h('button', { type: 'button', class: 'chip', onclick: () => setState({ root: relative, keyQuality: isMajor ? 'minor' : 'major', scaleId: isMajor ? 'aeolian' : 'ionian' }) },
        `Relative ${isMajor ? 'minor' : 'major'}: ${noteName(relative)}${isMajor ? 'm' : ''}`),
      h('button', { type: 'button', class: 'chip', onclick: () => setState({ keyQuality: isMajor ? 'minor' : 'major', scaleId: isMajor ? 'aeolian' : 'ionian' }) },
        `Parallel ${isMajor ? 'minor' : 'major'}: ${noteName(st.root)}${isMajor ? 'm' : ''}`),
      enharmonic
        ? h('button', { type: 'button', class: 'chip', onclick: () => setState({ root: enharmonic }) }, `Spell as ${noteName(enharmonic)}${isMajor ? '' : 'm'}`)
        : null,
      h('button', { type: 'button', class: 'chip strong', onclick: () => setState({ view: 'fretboard', fretMode: 'scale', scaleId: isMajor ? 'ionian' : 'aeolian' }) }, 'Show scale on fretboard'),
    ),

    h('div', { class: 'h3-row' },
      h('h3', {}, 'Scale'),
      playButton('Play scale', () => {
        const run = scaleMidis(pc(st.root), scale.formula.map((i) => i.semitones));
        playSequence([...run, ...[...run].reverse().slice(1)], 0.24);
      }),
    ),
    noteRow(notes, scale.formula),

    h(
      'div',
      { class: 'h3-row' },
      h('h3', {}, 'Chords in this key'),
      h('label', { class: 'toggle' },
        h('input', { type: 'checkbox', checked: showSevenths, onchange: (e: Event) => { showSevenths = (e.target as HTMLInputElement).checked; setState({}); } }),
        'Seventh chords'),
    ),
    h(
      'ol',
      { class: 'diatonic' },
      ...chords.map((c) =>
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', title: 'Show on fretboard', onclick: () => c.chord && openChord(c.root, c.chord.id) },
            h('span', { class: 'roman' }, c.roman),
            h('b', {}, c.symbol),
            h('small', {}, c.notes.map((x) => noteName(x)).join(' ')),
          ),
          playButton('', () => playChord(midisOf(c)), 'mini'),
        ),
      ),
    ),
    h('p', { class: 'hint' }, 'Select a chord to see it on the fretboard, or its play button to hear it.'),

    h('h3', {}, 'Common progressions'),
    h(
      'ul',
      { class: 'progressions' },
      ...progressions.map((p) => {
        const pcs = progressionChords(st.root, isMajor ? 'ionian' : 'aeolian', p);
        return h(
          'li',
          {},
          h('div', { class: 'prog-head' },
            h('b', {}, p.name),
            h('span', { class: 'prog-romans' }, pcs.map((c) => c.roman).join(' – ')),
            playButton('Play', () => playProgression(pcs.map(midisOf)), 'small')),
          h(
            'div',
            { class: 'prog-chords' },
            ...pcs.map((c) => h('button', { type: 'button', class: 'chip', onclick: () => c.chord && openChord(c.root, c.chord.id) }, c.symbol)),
          ),
          h('p', {}, p.note),
        );
      }),
    ),
  );
}

function explainer(): HTMLElement {
  const sec = (title: string, ...body: (string | HTMLElement)[]) =>
    h('details', {}, h('summary', {}, title), h('div', { class: 'prose' }, ...body.map((b) => (typeof b === 'string' ? h('p', {}, b) : b))));
  return h(
    'section',
    { class: 'explainer' },
    h('h2', {}, 'How the circle works'),
    sec(
      'Why fifths?',
      'Going clockwise, each key is a perfect fifth (seven frets) above the last: C, G, D, A and so on. After twelve steps you land back on C, having visited every note once.',
      'Each step clockwise changes exactly one note of the scale. G major is C major with F raised to F♯; D major then also raises C to C♯. That is why neighboring keys sound closely related and why modulating to a neighbor is so smooth.',
      'Counter-clockwise the steps are fourths, and each one adds a flat instead: C, F (B♭), B♭ (B♭ E♭), and on around.',
    ),
    sec(
      'Reading key signatures',
      'Sharps always appear in the order F C G D A E B, and flats in the reverse order, B E A D G C F. The number on each outer segment tells you how many.',
      'Shortcut for sharp keys: the last sharp is the 7th of the scale, so the key is a half step above it (last sharp C♯ → D major). For flat keys, the second-to-last flat names the key (B♭ E♭ A♭ → E♭ major).',
    ),
    sec(
      'Relative minors',
      'The inner ring shows the relative minor of each major key: the same notes and key signature, but starting on the 6th degree. A minor and C major share every note; only the home base changes.',
      'On the fretboard this is why the A minor pentatonic box and the C major pentatonic box are the same shape, just with a different root.',
    ),
    sec(
      'Finding the chords of a key',
      'The highlighted wedge holds all seven chords of the selected key. The key sits in the middle with its IV to the left and its V to the right; the three minor chords ii, vi and iii sit beneath them, and vii° is in the innermost ring.',
      'That is why I–IV–V songs feel so natural: the three chords are next-door neighbors. A ii–V–I moves counter-clockwise one step at a time, each chord resolving down a fifth to the next.',
    ),
    sec(
      'Enharmonic keys at the bottom',
      'Around six o’clock the circle wraps around. F♯ major (6 sharps) and G♭ major (6 flats) sound the same and are fingered the same on guitar; which spelling you use depends on context. B/C♭ and D♭/C♯ overlap the same way, which is why those segments carry two names.',
    ),
    sec(
      'Using it on guitar',
      'Capo math lives on the circle too. Bluegrass players reach for G, C, D and A shapes because they are next to each other and keep open strings ringing; a capo then moves those shapes into the key a singer needs.',
      'Fiddle-tune keys (G, D, A) cluster on the sharp side for the same reason: they suit open strings on both fiddle and guitar.',
    ),
  );
}

export function renderCircle(root: HTMLElement, st: State = getState()): void {
  root.replaceChildren(
    h(
      'div',
      { class: 'circle-layout' },
      h('div', { class: 'circle-wrap' }, circleSvg(st), h('p', { class: 'hint center' }, 'Select a major (outer) or minor (inner) key.')),
      keyPanel(st),
    ),
    explainer(),
  );
}

/** Close-position pitches for a diatonic chord, root between C3 and B3. */
function midisOf(c: DiatonicChord): number[] {
  return chordMidis(pc(c.root), c.chord ? c.chord.formula.map((i) => i.semitones) : [0, 4, 7]);
}
