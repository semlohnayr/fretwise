/**
 * Mandolin & bass: the same theory on two other fretted instruments.
 * Mandolin gets positions and chop chords; bass gets arpeggio boxes and
 * simple bass lines to play along with.
 */
import {
  type Interval, type Note, type Tuning, type Grip, type Voicing, type BassNote, type DiatonicChord,
  SCALES, CHORDS, scaleById, chordById, scaleNotes, chordNotes, chordSymbol, noteName, pc, mod, intervalLabel, intervalName,
  fretPc, stringMidis, MANDOLIN, BASS4, BASS5, closedGrips, openGrips, mandolinPositions, inPosition, POSITION_SPAN,
  arpeggioBox, bassLine, MAJOR_PROGRESSIONS, MINOR_PROGRESSIONS, progressionChords, autoTab,
} from '../theory';
import { type State, getState, setState } from '../state';
import { h, s, select, segmented, pageTabs, disclosure } from './dom';
import { rootPicker, playButton, degreeClass, noteRow } from './controls';
import { neckSvg, chordDiagram, type NeckMark } from './fretboard';
import { tabSvg, type TabNote } from './tab';
import { playChord, playNote, playNoteAt, playSequence } from '../audio';
import * as metro from '../metronome';
import { setOpen as openMetronome } from './metronome';
import { markNow } from './highlight';

const FRETS = 15;

interface Content {
  title: string;
  notes: Note[];
  intervals: Interval[];
  /** Pitch class → note and interval, for labelling the neck. */
  marks: Map<number, { note: Note; interval: Interval }>;
}

function content(st: State): Content {
  const isScale = st.instShow === 'scale';
  const def = isScale ? scaleById(st.scaleId) : chordById(st.chordId);
  const notes = isScale ? scaleNotes(st.root, scaleById(st.scaleId)) : chordNotes(st.root, chordById(st.chordId));
  const intervals = def.formula;
  const marks = new Map<number, { note: Note; interval: Interval }>();
  notes.forEach((note, i) => {
    if (!marks.has(pc(note))) marks.set(pc(note), { note, interval: intervals[i] });
  });
  const title = isScale ? `${noteName(st.root)} ${scaleById(st.scaleId).name.toLowerCase()}` : chordSymbol(st.root, chordById(st.chordId));
  return { title, notes, intervals, marks };
}


/** String names as players say them: the G string, the low E string. */
function stringName(tn: Tuning, i: number): string {
  const name = noteName(tn.strings[i]);
  if (tn === MANDOLIN || tn.strings.filter((x) => pc(x) === pc(tn.strings[i])).length === 1) return name;
  return i === 0 ? `low ${name}` : name;
}

/* ---------- The neck ---------- */

interface NeckOpts {
  /** Positions to draw normally; everything else is faded. Null = nothing faded. */
  inside: ((string: number, fret: number) => boolean) | null;
  /** Positions to ring (a chosen grip). */
  ring: Set<string>;
}

function neck(tn: Tuning, c: Content, st: State, o: NeckOpts): HTMLElement {
  const marks: NeckMark[] = [];
  const opens = stringMidis(tn);
  tn.strings.forEach((_, str) => {
    for (let f = 0; f <= FRETS; f++) {
      const m = c.marks.get(fretPc(tn, str, f));
      if (!m) continue;
      const label = st.labels === 'names' ? noteName(m.note) : st.labels === 'intervals' ? intervalLabel(m.interval) : '';
      const key = `${str}:${f}`;
      const faded = o.inside && !o.inside(str, f) && !o.ring.has(key);
      marks.push({
        string: str,
        fret: f,
        cls: `${degreeClass(m.interval)} ${m.interval.degree === 1 ? 'root' : ''} ${faded ? 'faded' : ''} ${o.ring.has(key) ? 'grip' : ''}`,
        label,
      });
    }
  });
  const svg = neckSvg(tn, FRETS, marks);
  svg.setAttribute('aria-label', `${c.title} on the ${st.instrument === 'mandolin' ? 'mandolin' : 'bass'} neck`);
  // Each dot plays its note and names it for screen readers.
  svg.querySelectorAll<SVGGElement>('.dot').forEach((el) => {
    const [str, f] = el.dataset.pos!.split(':').map(Number);
    const m = c.marks.get(fretPc(tn, str, f))!;
    el.append(s('title', {}, `${noteName(m.note)}, ${intervalName(m.interval)} (${stringName(tn, str)} string, fret ${f})`));
    el.addEventListener('click', () => playNote(opens[str] + f));
  });
  return h('div', { class: 'neck-scroll inst-neck', tabindex: '0', 'aria-label': 'Neck, scroll horizontally' }, svg);
}

/** Notes inside a region, one per pitch, low to high (for play buttons and play-along). */
function notesIn(tn: Tuning, c: Content, inside: (string: number, fret: number) => boolean): { midi: number; pos: string }[] {
  const opens = stringMidis(tn);
  const seen = new Set<number>();
  const out: { midi: number; pos: string }[] = [];
  tn.strings.forEach((_, str) => {
    for (let f = 0; f <= FRETS; f++) {
      const midi = opens[str] + f;
      if (inside(str, f) && c.marks.has(fretPc(tn, str, f)) && !seen.has(midi)) {
        seen.add(midi);
        out.push({ midi, pos: `${str}:${f}` });
      }
    }
  });
  return out.sort((a, b) => a.midi - b.midi);
}

const markNeck = (pos: string) => markNow(`.inst-neck .dot[data-pos="${pos}"]`);

function playAlong(track: metro.Track): void {
  metro.setTrack(track);
  openMetronome(true);
  if (!metro.isRunning()) metro.start();
}

/* ---------- Shared controls ---------- */

function controls(st: State, tn: Tuning, extra: (HTMLElement | null)[]): HTMLElement {
  return h(
    'div',
    { class: 'controls' },
    h('div', { class: 'control-row' }, rootPicker(st.root, (root) => setState({ root, instGrip: null }))),
    h(
      'div',
      { class: 'control-row' },
      segmented('Show', st.instShow, [{ value: 'scale', label: 'Scale' }, { value: 'chord', label: st.instrument === 'bass' ? 'Chord / arpeggio' : 'Chord' }], (instShow) => setState({ instShow, instGrip: null })),
      st.instShow === 'scale'
        ? select('Scale', st.scaleId, SCALES.map((x) => ({ value: x.id, label: x.name, group: { mode: 'Modes', minor: 'Minor scales', pentatonic: 'Pentatonic', blues: 'Blues' }[x.family] })), (scaleId) => setState({ scaleId }))
        : select('Chord', st.chordId, CHORDS.map((x) => ({ value: x.id, label: `${x.name} (${noteName(st.root)}${x.symbol})` })), (chordId) => setState({ chordId, instGrip: null })),
      ...extra,
      segmented('Labels', st.labels, [{ value: 'intervals', label: 'Intervals' }, { value: 'names', label: 'Notes' }, { value: 'none', label: 'None' }], (labels) => setState({ labels })),
    ),
    h('p', { class: 'hint inst-tuning' }, `Tuning: ${tn.strings.map((x) => noteName(x)).join(' ')}, lowest string first. Tap any dot to hear it.`),
  );
}

/* ---------- Mandolin ---------- */

function gripVoicing(g: Grip, intervals: Interval[]): Voicing {
  const tones = g.tones.map((t) => intervals.findIndex((i) => mod(i.semitones, 12) === t));
  return {
    frets: g.frets,
    tones,
    baseFret: Math.max(1, g.lo),
    fingers: g.frets.filter((f) => f > 0).length,
    omitsFifth: intervals.some((i) => i.semitones === 7) && !g.tones.includes(7),
  };
}

const gripName = (g: Grip) => (g.frets.some((f) => f > 9) ? g.frets.join('-') : g.frets.join(''));

function gripCards(title: string, hint: string, grips: Grip[], c: Content, st: State, opens: number[]): HTMLElement | null {
  if (!grips.length) return null;
  return h(
    'div',
    { class: 'grip-group' },
    h('h4', {}, title),
    h('p', { class: 'hint' }, hint),
    h(
      'ol',
      { class: 'voicing-grid' },
      ...grips.map((g) => {
        const name = gripName(g);
        const on = st.instGrip === name;
        const v = gripVoicing(g, c.intervals);
        const lowest = c.intervals[v.tones[0]!];
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: on ? 'on' : '',
              'aria-pressed': String(on),
              'aria-label': `${name}, ${intervalName(lowest).toLowerCase()} in the bass${v.omitsFifth ? ', no 5th' : ''}`,
              onclick: () => {
                playChord(g.frets.map((f, i) => opens[i] + f));
                setState({ instGrip: on ? null : name });
              },
            },
            chordDiagram(v, c.intervals, 4),
            h('span', { class: 'tab' }, name),
            h('small', {}, `${g.lo === 0 ? 'Open' : `Fret ${g.lo}`}, ${intervalLabel(lowest) === '1' ? 'root' : intervalLabel(lowest)} lowest${v.omitsFifth ? ', no 5th' : ''}`),
          ),
        );
      }),
    ),
  );
}

function renderMandolin(st: State, c: Content): HTMLElement[] {
  const tn = MANDOLIN;
  const opens = stringMidis(tn);
  const rootPc = pc(st.root);
  const isScale = st.instShow === 'scale';

  // Scale: positions. Chord: open and movable (chop) grips.
  const positions = mandolinPositions(tn, rootPc);
  const pos = isScale && positions.some((p) => p.start === st.mandoPos) ? st.mandoPos : -1;
  const semis = c.intervals.map((i) => i.semitones);
  const opensG = isScale ? [] : openGrips(tn, rootPc, semis, 2);
  const chops = isScale ? [] : closedGrips(tn, rootPc, semis).slice(0, 8);
  const chosen = [...opensG, ...chops].find((g) => gripName(g) === st.instGrip);
  const ring = new Set<string>(chosen ? chosen.frets.map((f, i) => `${i}:${f}`) : []);
  const inside = pos >= 0 ? (_s: number, f: number) => inPosition(f, pos) : chosen ? () => false : null;

  const posLabel = (p: { start: number; rootString: number | null }) =>
    p.start === 0 ? `Open position (frets 0–${POSITION_SPAN - 1})` : `Frets ${p.start}–${p.start + POSITION_SPAN - 1}, root on the ${stringName(tn, p.rootString!)} string`;

  const positionNotes = pos >= 0 ? notesIn(tn, c, (_s, f) => inPosition(f, pos)) : [];
  metro.setTrack(positionNotes.length ? metro.guideTrack(positionNotes, `${c.title}, ${pos === 0 ? 'open position' : `position at fret ${pos}`} (mandolin)`, markNeck) : null);

  const play = isScale
    ? playButton(pos >= 0 ? 'Play this position' : 'Play scale', () => {
        const run = pos >= 0 ? positionNotes.map((x) => x.midi) : c.intervals.map((i) => opens[0] + mod(rootPc - pc(tn.strings[0]), 12) + i.semitones);
        playSequence([...run, ...[...run].reverse().slice(1)], 0.2);
      })
    : playButton('Strum', () => playChord((chosen ?? opensG[0] ?? chops[0])?.frets.map((f, i) => opens[i] + f) ?? []));

  const info = h(
    'section',
    { class: 'inst-info' },
    h('div', { class: 'h3-row' }, h('h3', {}, c.title), play,
      positionNotes.length ? h('button', { type: 'button', class: 'chip', onclick: () => playAlong(metro.guideTrack(positionNotes, `${c.title} (mandolin)`, markNeck)) }, 'Play along with the metronome') : null),
    noteRow(c.notes, c.intervals),
    isScale && pos >= 0
      ? h('p', { class: 'hint' }, 'Two frets per finger: index on the first two frets of the position, middle on the next two, ring on the next two, pinky on the last. The fret after that is the next string open, so every note in the position appears exactly once.')
      : null,
  );

  const chordSection = isScale
    ? null
    : h(
        'section',
        { class: 'voicings' },
        h('div', { class: 'h3-row' }, h('h3', {}, 'Mandolin chord shapes'),
          chosen ? h('button', { type: 'button', class: 'chip', onclick: () => setState({ instGrip: null }) }, 'Show all chord tones') : null),
        opensG.length || chops.length ? null : h('p', { class: 'hint' }, 'No four-string grip fits this chord in a four-fret stretch. Try a simpler chord type.'),
        gripCards('Open position', 'Ringing open strings. Every string is played; the diagrams show one line per pair of strings.', opensG, c, st, opens),
        gripCards(
          'Movable chop shapes',
          'No open strings, so each shape slides anywhere on the neck. Play them on beats 2 and 4 and release the pressure right after the strum for the bluegrass chop.',
          chops, c, st, opens,
        ),
      );

  return [
    h('p', { class: 'lead' },
      'A mandolin is tuned like a fiddle, G D A E from the lowest string, each a fifth above the last. Strings come in pairs tuned to the same note, so the neck shows four lines. ',
      'Any shape you learn moves to every string and every fret without changing.'),
    controls(st, tn, [
      isScale
        ? select('Position', String(pos), [{ value: '-1', label: 'Whole neck' }, ...positions.map((p) => ({ value: String(p.start), label: posLabel(p) }))], (v) => setState({ mandoPos: Number(v) }))
        : null,
    ]),
    neck(tn, c, st, { inside, ring }),
    info,
    ...(chordSection ? [chordSection] : []),
    h(
      'section',
      { class: 'explainer' },
      h('h2', {}, 'How the mandolin works'),
      disclosure('mando-fifths', 'Tuned in fifths', '', [h('div', { class: 'prose' },
        h('p', {}, 'Every pair of strings is a fifth apart, the same gap all the way across. That is why one fingering works everywhere: a scale shape on the G and D strings is the same shape on the D and A strings, a fifth higher.'),
        h('p', {}, 'Fret 7 on any string is the next string open. Players use that to tune and to choose between a fretted note and an open one.'),
        h('p', {}, 'The neck covers a lot of range in a small space: two octaves fit in one position without shifting, which is why fiddle tunes sit so well on the mandolin.'))], 'info'),
      disclosure('mando-chop', 'Chop chords and the backbeat', '', [h('div', { class: 'prose' },
        h('p', {}, 'In a bluegrass band the mandolin is the snare drum. On beats 2 and 4 it plays a closed, four-string chord and damps it straight away by easing off the fretting hand, a short percussive "chop".'),
        h('p', {}, 'Closed shapes are used because nothing rings open: the chop stays short, and the same grip moves to every chord in the tune. Start with the shape that has the root on the G string and slide it between I, IV and V.'))], 'info'),
      disclosure('mando-guitar', 'Coming from guitar', '', [h('div', { class: 'prose' },
        h('p', {}, 'The mandolin’s strings are the guitar’s top four turned upside down: E A D G on guitar, G D A E on mandolin, an octave higher. Your note names carry over, but chord shapes do not, because guitar uses fourths and one third.'),
        h('p', {}, 'Frets are close together, so reach is easy; the two-frets-per-finger position replaces the guitar’s one finger per fret.'))], 'info'),
    ),
  ];
}

/* ---------- Bass ---------- */

function bassTrack(line: BassNote[], tabPos: (string | null)[], label: string, length: number): metro.Track {
  return {
    label,
    beatsPerBar: 4,
    schedule(from, to, time) {
      const first = Math.floor(from / length);
      const last = Math.ceil(to / length);
      for (let m = first; m <= last; m++) {
        line.forEach((n, i) => {
          const b = n.beat + m * length;
          if (b < from - 1e-9 || b >= to - 1e-9 || b < 0) return;
          const t = time(b);
          // Bass notes are held for their length and damped before the next one.
          playNoteAt(n.midi, t, 0.95, Math.max(0.12, (time(b + n.beats) - t) * 0.92));
          metro.at(t, () => markNow([`.bass-tab .tab-note[data-i="${i}"]`, tabPos[i] ? `.inst-neck .dot[data-pos="${tabPos[i]}"]` : ''].filter(Boolean).join(', ')));
        });
      }
    },
  };
}

function bassLines(st: State, tn: Tuning): { el: HTMLElement; track: metro.Track } {
  const minor = st.keyQuality === 'minor';
  const progs = minor ? MINOR_PROGRESSIONS : MAJOR_PROGRESSIONS;
  const prog = progs[Math.min(st.bassProg, progs.length - 1)];
  const chords: DiatonicChord[] = progressionChords(st.root, minor ? 'aeolian' : 'ionian', prog);
  const line = bassLine(tn, chords, st.bassStyle);
  const firstFret = mod(pc(chords[0].root) - pc(tn.strings[0]), 12);
  const tab = autoTab(tn, line.map((x) => x.midi), { style: 'position', position: Math.max(1, firstFret - 1), maxFret: 12 });
  const length = chords.length * 4;
  const tabNotes: TabNote[] = line.map((x, i) => ({
    onset: x.beat,
    dur: x.beats,
    pos: tab[i],
    pick: null,
    chord: i === 0 || line[i - 1].bar !== x.bar ? chords[x.bar].symbol : undefined,
  }));
  const tabPos = tab.map((p) => (p ? `${p.string}:${p.fret}` : null));
  const keyName = `${noteName(st.root)} ${minor ? 'minor' : 'major'}`;
  const label = `${prog.name} bass line in ${keyName}`;
  const roles = (bar: number) => line.filter((x) => x.bar === bar).map((x) => x.role).join(' ');
  const track = bassTrack(line, tabPos, label, length);

  const el = h(
    'section',
    { class: 'bass-lines' },
    h('h3', {}, 'Bass lines'),
    h('p', { class: 'hint' }, 'One bar per chord in the key above. Start the metronome to hear the line with a click; the notes light up on the tab and the neck.'),
    h(
      'div',
      { class: 'control-row' },
      segmented('Key', st.keyQuality, [{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }], (keyQuality) => setState({ keyQuality, bassProg: 0 })),
      select('Progression', String(progs.indexOf(prog)), progs.map((p, i) => ({ value: String(i), label: p.name })), (v) => setState({ bassProg: Number(v) })),
      segmented('Style', st.bassStyle, [{ value: 'root-five', label: 'Root–fifth' }, { value: 'walking', label: 'Walking' }], (bassStyle) => setState({ bassStyle })),
    ),
    h('p', { class: 'progression-line' }, chords.map((c) => `${c.symbol} (${c.roman})`).join('  →  ')),
    h('div', { class: 'tab-scroll bass-tab' }, tabSvg(tabNotes, { stringNames: tn.strings.map((x) => noteName(x)), beatsPerBar: 4, length, barsPerLine: 4 })),
    h('div', { class: 'h3-row' },
      h('button', { type: 'button', class: 'chip strong', onclick: () => playAlong(track) }, 'Play with the metronome'),
      playButton('Hear one pass', () => {
        const step = 60 / metro.settings.bpm;
        line.forEach((x) => playNote(x.midi, x.beat * step, 0.95));
      })),
    h('p', { class: 'hint' },
      st.bassStyle === 'root-five'
        ? `Root on beat 1, fifth on beat 3. The fifth drops below the root when the low string reaches it, the classic bluegrass and country bass. Bar 1 reads ${roles(0)}.`
        : `Root, third, fifth, then a note a half step from the next chord’s root, so each bar leads into the next. The last note of each bar (→) is the approach note. Bar 1 reads ${roles(0)}.`),
    h('p', { class: 'hint' }, prog.note),
  );
  return { el, track };
}

function renderBass(st: State, c: Content): HTMLElement[] {
  const tn = st.bassStrings === 5 ? BASS5 : BASS4;
  const opens = stringMidis(tn);
  const rootPc = pc(st.root);
  const isChord = st.instShow === 'chord';
  const boxString = isChord && st.bassBox >= 0 && st.bassBox <= 2 && st.bassBox < tn.strings.length - 2 ? st.bassBox : -1;
  const box = boxString >= 0 ? arpeggioBox(tn, rootPc, c.intervals.map((i) => i.semitones), boxString) : null;
  const boxSet = new Set(box?.notes.map((x) => `${x.string}:${x.fret}`) ?? []);
  const boxNotes = box ? box.notes.map((x) => ({ midi: x.midi, pos: `${x.string}:${x.fret}` })) : [];

  // The metronome's play-along: the arpeggio box when one is chosen, otherwise the bass line.
  const lines = bassLines(st, tn);
  metro.setTrack(boxNotes.length ? metro.guideTrack(boxNotes, `${c.title} arpeggio (bass)`, markNeck) : lines.track);

  const rootOnLow = opens[0] + mod(rootPc - pc(tn.strings[0]), 12);
  const play = isChord
    ? playButton(box ? 'Play this arpeggio' : 'Play arpeggio', () => {
        const run = box ? boxNotes.map((x) => x.midi) : [...c.intervals.map((i) => rootOnLow + i.semitones), rootOnLow + 12];
        playSequence([...run, ...[...run].reverse().slice(1)], 0.26);
      })
    : playButton('Play scale', () => {
        const run = [...c.intervals.map((i) => rootOnLow + i.semitones), rootOnLow + 12];
        playSequence([...run, ...[...run].reverse().slice(1)], 0.24);
      });

  const boxOpts = [{ value: '-1', label: 'Whole neck' }, ...tn.strings.slice(0, tn.strings.length - 2).map((_, i) => ({ value: String(i), label: `Root on ${stringName(tn, i)}` }))];

  return [
    h('p', { class: 'lead' },
      'A bass has the same four strings as the bottom of a guitar, E A D G, an octave lower; a five-string adds a low B. ',
      'Its job is the root and the rhythm: chord tones on the strong beats, with notes in between that lead to the next chord.'),
    controls(st, tn, [
      segmented('Strings', String(st.bassStrings), [{ value: '4', label: '4' }, { value: '5', label: '5' }], (v) => setState({ bassStrings: Number(v) as 4 | 5, bassBox: -1 })),
      isChord ? segmented('Arpeggio box', String(boxString), boxOpts, (v) => setState({ bassBox: Number(v) })) : null,
    ]),
    neck(tn, c, st, { inside: box ? (str, f) => boxSet.has(`${str}:${f}`) : null, ring: new Set() }),
    h(
      'section',
      { class: 'inst-info' },
      h('div', { class: 'h3-row' }, h('h3', {}, c.title), play,
        boxNotes.length ? h('button', { type: 'button', class: 'chip', onclick: () => playAlong(metro.guideTrack(boxNotes, `${c.title} arpeggio (bass)`, markNeck)) }, 'Play along with the metronome') : null),
      noteRow(c.notes, c.intervals),
      box
        ? h('p', { class: 'hint' }, `One finger per fret, frets ${box.start}–${box.start + 3}: the root is on the ${stringName(tn, box.rootString)} string at fret ${box.rootFret}. Play it up and back down, then move the box to another root without changing the fingering.`)
        : isChord ? h('p', { class: 'hint' }, 'Pick a root string for a one-position arpeggio box you can move to any chord.') : null,
    ),
    lines.el,
    h(
      'section',
      { class: 'explainer' },
      h('h2', {}, 'How the bass fits'),
      disclosure('bass-fourths', 'Tuned in fourths', '', [h('div', { class: 'prose' },
        h('p', {}, 'Every string is a fourth above the one below, with no odd string like the guitar’s B. A shape on the E and A strings is the same shape on the A and D strings, so a box you learn for one root works for all of them.'),
        h('p', {}, 'The octave of any note is two strings up and two frets over; the fifth is one string up and two frets over. Those two moves are most of a root–fifth line.'))], 'info'),
      disclosure('bass-five', 'The low fifth', '', [h('div', { class: 'prose' },
        h('p', {}, 'The fifth directly below the root is on the same fret one string down. Alternating root and low fifth is the foundation of bluegrass, country and polka: it keeps the low end moving without muddying the chord.'),
        h('p', {}, 'On a G chord with the root on the E string at fret 3, there is no string below it on a four-string, so the line takes the fifth above instead. A five-string bass has the low B string for exactly this.'))], 'info'),
      disclosure('bass-walk', 'Walking toward the next chord', '', [h('div', { class: 'prose' },
        h('p', {}, 'A walking line spends the first three beats on chord tones and the last beat on a note a half step above or below where it is going. The ear hears that half step as a pull toward the next root, so the change lands harder.'),
        h('p', {}, 'Once that works, try a scale step on beat 4 instead, or move through the chord tones in a different order.'))], 'info'),
    ),
  ];
}

/* ---------- Page ---------- */

export function renderInstruments(root: HTMLElement, st: State = getState()): void {
  const c = content(st);
  root.replaceChildren(
    h('div', { class: 'title-row' }, h('h2', {}, 'Mandolin & bass')),
    pageTabs('Instrument', st.instrument, [{ value: 'mandolin', label: 'Mandolin' }, { value: 'bass', label: 'Bass guitar' }], (instrument) => setState({ instrument, instGrip: null })),
    ...(st.instrument === 'mandolin' ? renderMandolin(st, c) : renderBass(st, c)),
  );
}
