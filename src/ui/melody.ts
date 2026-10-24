/**
 * Melody page: fiddle tunes, licks, generated melodies and soloing over chord
 * changes, all shown as tab and on the neck, played through the metronome
 * engine (so the speed trainer, count-in and click all apply), and graded
 * from the microphone.
 */
import {
  type Note, type Tuning, type TimedNote, type Timeline, type Stroke, type ChordSpan, type GradeSummary, type TabPos,
  n, pc, noteName, spellPc, between, transpose, intervalLabel, scaleById, scaleNotes, harmonize, chordNotes,
  parseAbc, expandRepeats, splitParts, timeline, autoTab, alternatePicks, economyPicks, patternPicks,
  randomMelody, seeded, parseChordSymbol, chordSpans, progressionSpans, boomChuck, analyzeRecording, gradeOnsets, median,
  stringMidis,
} from '../theory';
import { getState, setState, type State } from '../state';
import * as metro from '../metronome';
import * as mic from '../mic';
import { playNoteAt, isMuted } from '../audio';
import { h, segmented, select, disclosure, pageTabs, pageTitle } from './dom';
import { openSpeedTrainer } from './metronome';
import { degreeClass, rootPicker } from './controls';
import { getTuning, neckSvg, type NeckMark } from './fretboard';
import { tabSvg, type TabNote } from './tab';
import { markNow } from './highlight';
import { TUNES, type TuneEntry } from '../content/tunes';
import { LICKS } from '../content/licks';
import { WARMUPS, warmupById } from '../content/warmups';

/* ---------- Page settings (kept for the session; not part of the URL) ---------- */

type Fingering = 'open' | 'pos5' | 'pos7';

const ms = {
  part: -1, // -1 = whole tune
  phrase: -1, // -1 = whole part; otherwise index of a 2-bar phrase
  useCapo: true,
  pick: 'alternate' as 'alternate' | 'economy' | 'pattern',
  fingering: 'open' as Fingering,
  backing: true,
  countIn: true,
  loop: true,
  lickKey: n('G'),
  warmFret: 1,
  rnd: { key: n('G'), scaleId: 'major-pentatonic', bars: 4, rhythm: 'mixed' as 'quarters' | 'eighths' | 'mixed', seed: 1 },
  ch: { key: n('G'), prog: 'three', barsEach: 1, show: 'tones' as 'tones' | 'thirds', sevenths: false },
};

/** Guitar music is written an octave above the pitch that sounds. */
const GUITAR_OCTAVE = -12;

/* ---------- User tunes (pasted ABC, stored in this browser) ---------- */

const USER_KEY = 'fretwise:user-tunes';

function userTunes(): TuneEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_KEY) ?? '[]') as { id: string; abc: string }[];
    return raw.map((u) => ({ id: u.id, title: parseAbc(u.abc).title, note: 'Added by you.', abc: u.abc, source: { label: '', url: '' } }));
  } catch {
    return [];
  }
}

function saveUserTunes(list: { id: string; abc: string }[]): boolean {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const allTunes = (): TuneEntry[] => [...TUNES, ...userTunes()];

/* ---------- Exercises ---------- */

interface Exercise {
  /** Identity, so grading results are only shown for the exercise they belong to. */
  id: string;
  title: string;
  keyRoot: Note;
  tl: Timeline;
  /** Bar number of the first bar shown. */
  firstBar: number;
  /** e.g. "D major", "A Mixolydian". */
  keyLabel: string;
  spans: ChordSpan[];
  capo: number;
  picks?: string;
  /** Fixed fingering (warm-ups), instead of working it out. */
  fixedPos?: TabPos[];
  /** Label the neck with fretting-hand fingers, counting from this fret as finger 1. */
  fingerFrom?: number;
}

function tuneExercise(st: State): { ex: Exercise; tune: TuneEntry; parts: number; phrases: number } | null {
  const tunes = allTunes();
  const tune = tunes.find((t) => t.id === st.tuneId) ?? tunes[0];
  if (!tune) return null;
  const parsed = parseAbc(tune.abc);
  const parts = splitParts(parsed.measures);
  const partIdx = ms.part >= 0 && ms.part < parts.length ? ms.part : -1;
  let measures = expandRepeats(partIdx < 0 ? parsed.measures : parts[partIdx]);

  // Two-bar phrases of the chosen part (a leading pickup joins the first phrase).
  const pickup = measures.length > 1 && measures[0].notes.reduce((a, x) => a + x.dur, 0) < parsed.beatsPerBar - 1e-6;
  const full = pickup ? measures.slice(1) : measures;
  const phraseCount = partIdx < 0 ? 0 : Math.ceil(Math.min(full.length, 8) / 2);
  let start = 0;
  if (partIdx >= 0 && ms.phrase >= 0 && ms.phrase < phraseCount) {
    start = ms.phrase * 2;
    const chunk = full.slice(start, start + 2);
    measures = ms.phrase === 0 && pickup ? [measures[0], ...chunk] : chunk;
  }
  const tl = timeline(measures, parsed.beatsPerBar);
  // A pickup sits in bar 0, so the first full bar is bar 1.
  const firstBar = tl.offset > 0 ? start : start + 1;
  const shifted = { ...tl, notes: tl.notes.map((x) => ({ ...x, midi: x.midi === null ? null : x.midi + GUITAR_OCTAVE })) };
  return {
    tune,
    parts: parts.length,
    phrases: phraseCount,
    ex: {
      id: `tune:${tune.id}:${partIdx}:${ms.phrase}`,
      title: tune.title,
      keyRoot: parsed.key,
      tl: shifted,
      firstBar,
      keyLabel: `${noteName(parsed.key)} ${parsed.mode === 'ionian' ? 'major' : parsed.mode === 'aeolian' ? 'minor' : parsed.mode[0].toUpperCase() + parsed.mode.slice(1)}`,
      spans: chordSpans(tl.chords, tl.length),
      capo: ms.useCapo ? tune.capo ?? 0 : 0,
    },
  };
}

function lickExercise(st: State): Exercise {
  const lick = LICKS.find((l) => l.id === st.lickId) ?? LICKS[0];
  const parsed = parseAbc(lick.abc);
  const tl = timeline(parsed.measures, parsed.beatsPerBar);
  // Move from G to the chosen key by the nearest distance (up to a fourth up or a fifth down).
  let shift = (((pc(ms.lickKey) - 7) % 12) + 12) % 12;
  if (shift > 5) shift -= 12;
  const iv = between(n('G'), ms.lickKey);
  const notes: TimedNote[] = tl.notes.map((x) => ({
    ...x,
    midi: x.midi === null ? null : x.midi + GUITAR_OCTAVE + shift,
    spelled: x.spelled ? transpose(x.spelled, iv) : null,
    chord: x.chord ? transposeSymbol(x.chord, iv) : undefined,
  }));
  const chords = tl.chords.map((c) => ({ onset: c.onset, symbol: transposeSymbol(c.symbol, iv) }));
  return {
    id: `lick:${lick.id}:${noteName(ms.lickKey, true)}`,
    title: lick.name,
    keyRoot: ms.lickKey,
    tl: { ...tl, notes, chords },
    firstBar: 1,
    keyLabel: `${noteName(ms.lickKey)} major`,
    spans: chordSpans(chords, tl.length),
    capo: 0,
    picks: lick.picks,
  };
}

function transposeSymbol(sym: string, iv: ReturnType<typeof between>): string {
  const p = parseChordSymbol(sym);
  if (!p) return sym;
  return noteName(transpose(p.root, iv)) + p.chord.symbol;
}

const RANDOM_SCALES = ['major-pentatonic', 'ionian', 'mixolydian', 'minor-pentatonic', 'blues', 'dorian', 'aeolian'];

function randomExercise(tn: Tuning): Exercise {
  const r = ms.rnd;
  const scale = scaleById(r.scaleId);
  const opens = stringMidis(tn);
  const posLo = ms.fingering === 'open' ? 0 : ms.fingering === 'pos5' ? 4 : 6;
  const posHi = ms.fingering === 'open' ? 4 : posLo + 4;
  const mel = randomMelody(seeded(r.seed * 7919 + 13), {
    rootPc: pc(r.key),
    scale: scale.formula.map((i) => i.semitones),
    bars: r.bars,
    beatsPerBar: 4,
    rhythm: r.rhythm,
    low: opens[0] + posLo,
    high: opens[opens.length - 1] + posHi,
  });
  // Spell each pitch the way the key does.
  const spelling = new Map(scaleNotes(r.key, scale).map((x) => [pc(x), x]));
  let t = 0;
  const notes: TimedNote[] = mel.map((x) => {
    const note = { ...x, spelled: spelling.get(((x.midi! % 12) + 12) % 12) ?? spellPc(x.midi!), onset: t, bar: Math.floor(t / 4) };
    t += x.dur;
    return note;
  });
  // Backing: the home chord, major or minor to match the scale.
  const minor = scale.formula.some((i) => i.semitones === 3);
  const symbol = noteName(r.key) + (minor ? 'm' : '');
  notes[0].chord = symbol;
  const tl: Timeline = { notes, offset: 0, length: r.bars * 4, beatsPerBar: 4, chords: [{ onset: 0, symbol }] };
  return {
    id: `random:${noteName(r.key, true)}:${r.scaleId}:${r.bars}:${r.rhythm}:${r.seed}:${ms.fingering}`,
    title: `${noteName(r.key)} ${scale.name.toLowerCase()}, melody ${r.seed}`,
    keyRoot: r.key,
    tl,
    firstBar: 1,
    keyLabel: `${noteName(r.key)} ${scale.name.toLowerCase()}`,
    spans: chordSpans(tl.chords, tl.length),
    capo: 0,
  };
}

/* ---------- Tab and picking ---------- */

function picksFor(ex: Exercise, pos: ReturnType<typeof autoTab>): (Stroke | null)[] {
  const input = ex.tl.notes.map((x, i) => ({ onset: x.onset, string: pos[i]?.string ?? null, legato: x.legato }));
  if (ms.pick === 'pattern' && ex.picks) return patternPicks(input, ex.picks);
  return ms.pick === 'economy' ? economyPicks(input) : alternatePicks(input);
}

function tabStyle(): { style: 'open' | 'position'; position?: number } {
  return ms.fingering === 'open' ? { style: 'open' } : { style: 'position', position: ms.fingering === 'pos5' ? 5 : 7 };
}

/* ---------- Playback ---------- */

let grading: { exId: string; expected: { time: number; midi: number }[]; result?: GradeSummary; error?: string } | null = null;
let gradingActive = false;
let lastResult: { exId: string; summary: GradeSummary } | null = null;
let calibrationMsg = '';

function markNote(i: number, pos: string | null): void {
  markNow([`.tab .tab-note[data-i="${i}"]`, pos ? `.melody-neck .dot[data-pos="${pos}"]` : ''].filter(Boolean).join(', '));
}

function scheduleBacking(spans: ChordSpan[], bpb: number, length: number, from: number, to: number, time: (b: number) => number): void {
  const beatSec = time(from + 1) - time(from);
  for (const ev of boomChuck(spans, bpb, length, from, to)) {
    const t = time(ev.beat);
    if (ev.kind === 'bass') playNoteAt(ev.midis[0], t, 0.5, beatSec * 0.85);
    else ev.midis.forEach((m, j) => playNoteAt(m, t + j * 0.008, 0.24, Math.min(0.14, beatSec * 0.35)));
  }
}

function exerciseTrack(ex: Exercise, absPos: (string | null)[], opts: { grade?: boolean } = {}): metro.Track {
  const L = ex.tl.length;
  const loop = ms.loop && !opts.grade;
  return {
    label: ex.title,
    beatsPerBar: ex.tl.beatsPerBar,
    countIn: ms.countIn || opts.grade ? 1 : 0,
    stopAfter: loop ? undefined : L,
    quietClick: opts.grade,
    required: opts.grade,
    schedule(from, to, time) {
      if (to <= 0) return;
      const lo = Math.max(0, from);
      const k0 = Math.floor(lo / L);
      const k1 = loop ? Math.floor((to - 1e-9) / L) : 0;
      for (let k = k0; k <= k1; k++) {
        ex.tl.notes.forEach((note, i) => {
          if (note.midi === null) return;
          const b = note.onset + k * L;
          if (b < lo - 1e-9 || b >= to - 1e-9) return;
          const t = time(b);
          if (opts.grade) grading?.expected.push({ time: t, midi: note.midi });
          else playNoteAt(note.midi, t, 0.75);
          metro.at(t, () => markNote(i, absPos[i]));
        });
      }
      if (!opts.grade && ms.backing && ex.spans.length) scheduleBacking(ex.spans, ex.tl.beatsPerBar, L, lo, to, time);
    },
  };
}

async function startGrading(ex: Exercise, absPos: (string | null)[]): Promise<void> {
  metro.stop();
  try {
    await mic.open();
  } catch (e) {
    grading = { exId: ex.id, expected: [], error: (e as Error).message };
    rerender();
    return;
  }
  grading = { exId: ex.id, expected: [] };
  gradingActive = true;
  const track = exerciseTrack(ex, absPos, { grade: true });
  track.onStop = () => {
    const take = mic.stopRecording();
    gradingActive = false;
    if (!grading) return;
    const beatSec = 60 / metro.currentTempo();
    const onsets = analyzeRecording(take.samples, take.sampleRate, take.t0);
    const summary = gradeOnsets(grading.expected, onsets, Math.min(0.2, beatSec * 0.4));
    lastResult = { exId: ex.id, summary };
    grading = null;
    rerender();
  };
  metro.setTrack(track);
  mic.startRecording();
  metro.start();
  rerender();
}

async function calibrate(): Promise<void> {
  metro.stop();
  try {
    await mic.open();
  } catch (e) {
    calibrationMsg = (e as Error).message;
    rerender();
    return;
  }
  const clicks: number[] = [];
  gradingActive = true;
  calibrationMsg = 'Pick any open string exactly on each of the eight clicks…';
  const track: metro.Track = {
    label: 'Timing calibration',
    beatsPerBar: 4,
    countIn: 1,
    stopAfter: 8,
    quietClick: true,
    required: true,
    schedule(from, to, time) {
      for (let b = Math.ceil(Math.max(0, from) - 1e-9); b < to - 1e-9; b++) clicks.push(time(b));
    },
    onStop() {
      gradingActive = false;
      const take = mic.stopRecording();
      const onsets = analyzeRecording(take.samples, take.sampleRate, take.t0);
      const offsets: number[] = [];
      for (const c of clicks) {
        const near = onsets.reduce<number | null>((best, o) => (Math.abs(o.time - c) < 0.3 && (best === null || Math.abs(o.time - c) < Math.abs(best - c)) ? o.time : best), null);
        if (near !== null) offsets.push((near - c) * 1000);
      }
      if (offsets.length < 4) {
        calibrationMsg = `Only heard ${offsets.length} of 8 notes. Move closer to the microphone or play louder, then try again.`;
      } else {
        const residual = median(offsets);
        mic.setLatencyMs(mic.latencyMs() + residual);
        calibrationMsg = `Calibrated: the microphone runs ${Math.round(mic.latencyMs())} ms behind. Grading now allows for that.`;
      }
      metro.setTrack(null);
      rerender();
    },
  };
  metro.setTrack(track);
  mic.startRecording();
  metro.start();
  rerender();
}

/* ---------- Rendering helpers ---------- */

let container: HTMLElement | null = null;
const rerender = () => {
  if (container && getState().view === 'melody') renderMelody(container);
};

function playControls(ex: Exercise, absPos: (string | null)[]): HTMLElement {
  const running = metro.isRunning();
  const t = metro.settings;
  return h(
    'div',
    { class: 'melody-play' },
    h('button', {
      type: 'button',
      id: 'melody-go',
      class: `metro-go ${running && !gradingActive ? 'on' : ''}`,
      disabled: gradingActive,
      onclick: () => {
        if (metro.isRunning()) metro.stop();
        else {
          lastResult = null;
          metro.setTrack(exerciseTrack(ex, absPos));
          metro.start();
        }
      },
    }, running && !gradingActive ? 'Stop' : 'Play'),
    h('div', { class: 'tempo' },
      h('button', { type: 'button', class: 'step', 'aria-label': 'Slower', onclick: () => metro.update({ bpm: t.bpm - 5 }), disabled: t.rampOn }, '−'),
      h('output', { class: 'bpm' }, h('b', { id: 'melody-bpm' }, String(running ? metro.currentTempo() : t.rampOn ? t.ramp.from : t.bpm)), h('small', {}, 'BPM')),
      h('button', { type: 'button', class: 'step', 'aria-label': 'Faster', onclick: () => metro.update({ bpm: t.bpm + 5 }), disabled: t.rampOn }, '+')),
    h('button', {
      type: 'button',
      class: 'chip mic',
      disabled: gradingActive || !mic.micSupported(),
      title: mic.micSupported() ? 'Play it into your microphone and get each note checked' : 'This browser does not allow microphone access here',
      onclick: () => void startGrading(ex, absPos),
    }, gradingActive ? 'Listening…' : 'Grade my playing'),
    h('span', { id: 'mic-hearing', class: 'meta' }),
    t.rampOn ? h('span', { class: 'meta' }, `Speed trainer: ${t.ramp.from} to ${t.ramp.to} BPM`) : null,
  );
}

/** Everything about how it plays and how the tab is drawn, folded into one panel. */
function optionsPanel(ex: Exercise): HTMLElement {
  const t = metro.settings;
  const pickOpts: { value: 'alternate' | 'economy' | 'pattern'; label: string }[] = [
    { value: 'alternate', label: 'Alternate' },
    { value: 'economy', label: 'Economy' },
  ];
  if (ex.picks) pickOpts.unshift({ value: 'pattern', label: 'As written' });
  const pick = ms.pick === 'pattern' && !ex.picks ? 'alternate' : ms.pick;
  const on = [ms.countIn && 'count-in', ms.loop && 'loop', ex.spans.length && ms.backing && 'backing', t.click && 'click'].filter(Boolean).join(', ');
  const fingerName = { open: 'open position', pos5: '5th position', pos7: '7th position' }[ms.fingering];
  const summary = [
    on ? on[0].toUpperCase() + on.slice(1) : 'No count-in, loop, backing or click',
    `${pick === 'pattern' ? 'written' : pick} picking`,
    ex.fixedPos ? '' : fingerName,
  ].filter(Boolean).join('; ');
  const toggle = (label: string, checked: boolean, set: (v: boolean) => void) =>
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), label);
  return disclosure('melody-options', 'Options', summary, [
    h('div', { class: 'control-row' },
      toggle('Count-in bar', ms.countIn, (v) => { ms.countIn = v; rerender(); }),
      toggle('Loop', ms.loop, (v) => { ms.loop = v; rerender(); }),
      ex.spans.length ? toggle('Boom-chuck backing', ms.backing, (v) => { ms.backing = v; rerender(); }) : null,
      toggle('Click', t.click, (v) => metro.update({ click: v })),
      h('button', {
        type: 'button',
        class: 'chip',
        // The speed trainer lives in the metronome dock.
        onclick: () => openSpeedTrainer(),
      }, 'Speed trainer…')),
    h('div', { class: 'control-row' },
      segmented('Picking', pick, pickOpts, (v) => { ms.pick = v; rerender(); }),
      ex.fixedPos ? null : segmented('Fingering', ms.fingering, [
        { value: 'open', label: 'Open position' },
        { value: 'pos5', label: '5th position' },
        { value: 'pos7', label: '7th position' },
      ], (v) => { ms.fingering = v; rerender(); })),
  ]);
}

/* ---------- Warm-ups ---------- */

function warmupExercise(st: State, tn: Tuning): Exercise {
  const w = warmupById(st.warmupId);
  const opens = stringMidis(tn);
  const cells = w.cells(w.movable ? ms.warmFret : 0).filter((c) => tn.strings.length - c.string >= 0);
  let t = 0;
  const fixedPos: TabPos[] = [];
  const notes: TimedNote[] = cells.map((c) => {
    const s = tn.strings.length - c.string;
    const midi = opens[s] + c.fret;
    fixedPos.push({ string: s, fret: c.fret });
    const dur = c.dur ?? 0.5;
    const note: TimedNote = { midi, dur, spelled: spellPc(midi), onset: t, bar: Math.floor(t / 4), legato: c.legato };
    t += dur;
    return note;
  });
  const g = w.id === 'g-3nps' || w.id === 'pent-threes';
  return {
    id: `warmup:${w.id}:${w.movable ? ms.warmFret : 0}`,
    title: w.name,
    keyRoot: g ? n('G') : n('C'),
    keyLabel: g ? 'G major' : w.movable ? `Starting at fret ${ms.warmFret}` : 'Open strings',
    tl: { notes, offset: 0, length: Math.max(4, Math.ceil(t / 4 - 1e-9) * 4), beatsPerBar: 4, chords: [] },
    firstBar: 1,
    spans: [],
    capo: 0,
    fixedPos,
    fingerFrom: w.movable ? ms.warmFret : undefined,
  };
}

function warmupsTab(st: State, tn: Tuning): (HTMLElement | null)[] {
  const w = warmupById(st.warmupId);
  const ex = warmupExercise(st, tn);
  return [
    h('div', { class: 'controls' },
      h('div', { class: 'control-row' },
        select('Warm-up', w.id, WARMUPS.map((x) => ({ value: x.id, label: x.name })), (warmupId) => { lastResult = null; setState({ warmupId }); }),
        w.movable
          ? segmented('Start at fret', String(ms.warmFret), ['1', '3', '5', '7', '9'].map((f) => ({ value: f, label: f })), (v) => { ms.warmFret = Number(v); rerender(); })
          : null)),
    ...exerciseView(ex, tn,
      h('p', { class: 'lead' }, w.how, ' ', h('span', { class: 'meta' }, `Start around ${w.startBpm} BPM; go up 4–5 BPM after three clean passes.`)),
      []),
  ];
}

/** Lets a practice-session step jump straight to a part, phrase or starting fret. */
export function focusMelody(opts: { part?: number; phrase?: number; warmFret?: number; pick?: 'alternate' | 'economy' | 'pattern'; changesKey?: string; changesProg?: string }): void {
  if (opts.changesKey) ms.ch.key = n(opts.changesKey);
  if (opts.changesProg) ms.ch.prog = opts.changesProg;
  if (opts.part !== undefined) ms.part = opts.part;
  if (opts.phrase !== undefined) ms.phrase = opts.phrase;
  if (opts.warmFret !== undefined) ms.warmFret = opts.warmFret;
  if (opts.pick !== undefined) ms.pick = opts.pick;
  lastResult = null;
}

function exerciseView(ex: Exercise, tn: Tuning, lead: HTMLElement | null, extraInfo: (HTMLElement | null)[]): (HTMLElement | null)[] {
  const style = tabStyle();
  const pos = ex.fixedPos ?? autoTab(tn, ex.tl.notes.map((x) => x.midi), { ...style, capo: ex.capo, maxFret: 17 });
  const picks = picksFor(ex, pos);
  const result = lastResult && lastResult.exId === ex.id ? lastResult.summary : null;
  // Map graded notes (in order of pitched notes) back onto note indices.
  const verdicts: (string | undefined)[] = [];
  if (result) {
    let k = 0;
    ex.tl.notes.forEach((x, i) => {
      if (x.midi !== null) verdicts[i] = result.notes[k++]?.verdict;
    });
  }
  const tabNotes: TabNote[] = ex.tl.notes.map((x, i) => {
    const prev = ex.tl.notes[i - 1];
    return {
      onset: x.onset,
      dur: x.dur,
      pos: pos[i],
      pick: picks[i],
      legato: x.legato,
      up: prev && prev.midi !== null && x.midi !== null ? x.midi > prev.midi : true,
      chord: x.chord,
      cls: verdicts[i] ? `v-${verdicts[i]}` : '',
    };
  });
  const absPos = pos.map((p) => (p ? `${p.string}:${p.fret + ex.capo}` : null));
  if (!gradingActive) metro.setTrack(exerciseTrack(ex, absPos));

  // Neck: every distinct position used, labelled with its note name and coloured by scale degree.
  const seen = new Map<string, NeckMark>();
  ex.tl.notes.forEach((x, i) => {
    const p = pos[i];
    if (!p || x.midi === null) return;
    const key = `${p.string}:${p.fret + ex.capo}`;
    if (seen.has(key)) return;
    const spelled = x.spelled ?? spellPc(x.midi);
    if (ex.fingerFrom !== undefined && p.fret > 0) {
      // Chromatic drills: show which finger plays each fret.
      seen.set(key, { string: p.string, fret: p.fret, cls: 'finger', label: String(p.fret - ex.fingerFrom + 1) });
      return;
    }
    seen.set(key, { string: p.string, fret: p.fret + ex.capo, cls: degreeClass(between(ex.keyRoot, spelled)), label: noteName(spelled) });
  });
  const maxFret = Math.max(5, ...[...seen.values()].map((m) => m.fret)) + 2;
  const names = tn.strings.map((x) => noteName(x));

  return [
    h('div', { class: 'title-row' }, h('h2', {}, ex.title),
      ex.capo ? h('span', { class: 'capo-tag' }, `Capo ${ex.capo}`) : null,
      h('span', { class: 'meta' }, ex.keyLabel),
    ),
    lead,
    playControls(ex, absPos),
    optionsPanel(ex),
    isMuted() ? h('p', { class: 'error' }, 'Sound is off. Turn it on with the Sound button at the top of the page.') : null,
    gradePanel(result),
    h('div', { class: 'tab-scroll' }, tabSvg(tabNotes, { stringNames: names, beatsPerBar: ex.tl.beatsPerBar, length: ex.tl.length, firstBar: ex.firstBar })),
    h('p', { class: 'tab-key' },
      h('span', {}, h('b', {}, '⊓'), ' down'), h('span', {}, h('b', {}, 'V'), ' up'), h('span', {}, h('b', {}, 'h'), ' hammer-on'), h('span', {}, h('b', {}, 'p'), ' pull-off'),
      ex.capo ? h('span', {}, 'Frets counted from the capo') : null),
    h('div', { class: 'neck-scroll melody-neck' }, neckSvg(tn, Math.min(24, maxFret), [...seen.values()], ex.capo)),
    ex.fingerFrom !== undefined ? h('p', { class: 'tab-key' }, 'Numbers are fretting-hand fingers: 1 index, 2 middle, 3 ring, 4 little.') : null,
    ...extraInfo,
    gradingHelp(),
  ];
}

/** Results, errors and calibration feedback; nothing at all until there is something to say. */
function gradePanel(result: GradeSummary | null): HTMLElement | null {
  const err = grading?.error ?? '';
  if (!result && !err && !calibrationMsg) return null;
  return h(
    'section',
    { class: 'grade', 'aria-live': 'polite' },
    err ? h('p', { class: 'error' }, err) : null,
    calibrationMsg ? h('p', { class: 'meta' }, calibrationMsg) : null,
    result ? resultView(result) : null,
  );
}

function gradingHelp(): HTMLElement {
  return disclosure('grading-help', 'About grading', '', [
    h('div', { class: 'prose' },
      h('p', {}, 'Grade my playing counts you in with a quiet click, then listens while you play the phrase once at the current tempo. Each note is checked for pitch and timing and marked in the tab.'),
      h('p', {}, 'Headphones keep the click out of the microphone. Strings ringing over each other are fine, though damping each note gives the cleanest result.')),
    h('div', { class: 'control-row' },
      h('button', { type: 'button', class: 'chip', disabled: gradingActive || !mic.micSupported(), onclick: () => void calibrate() }, 'Calibrate timing'),
      h('span', { class: 'meta' }, `Do this once: pick an open string on eight clicks so the app can measure your microphone\u2019s delay${mic.latencyMs() ? ` (now ${Math.round(mic.latencyMs())} ms)` : ''}.`)),
  ], 'info');
}

function resultView(r: GradeSummary): HTMLElement {
  const count = (v: string) => r.notes.filter((x) => x.verdict === v).length;
  const feel = Math.abs(r.meanMs) < 15 ? 'right in the pocket' : r.meanMs < 0 ? `rushing by about ${-r.meanMs} ms` : `dragging by about ${r.meanMs} ms`;
  return h(
    'div',
    { class: 'grade-result' },
    h('dl', { class: 'score' },
      h('div', {}, h('dt', {}, 'Right notes'), h('dd', {}, `${r.hits}/${r.notes.length} (${Math.round(r.accuracy * 100)}%)`)),
      h('div', {}, h('dt', {}, 'Timing'), h('dd', {}, r.hits ? `±${r.meanAbsMs} ms` : '–'))),
    h('p', {}, r.hits ? `On average you were ${feel}.` : 'No notes matched. Check the microphone, then try a slower tempo.'),
    h('ul', { class: 'legend verdicts' },
      h('li', { class: 'v-hit' }, h('i', {}), `Right (${count('hit')})`),
      h('li', { class: 'v-octave' }, h('i', {}), `Wrong octave (${count('octave')})`),
      h('li', { class: 'v-wrong' }, h('i', {}), `Wrong note (${count('wrong')})`),
      h('li', { class: 'v-missed' }, h('i', {}), `Not heard (${count('missed')})`)),
  );
}

/* ---------- Tabs ---------- */

function tunesTab(st: State, tn: Tuning): (HTMLElement | null)[] {
  const built = tuneExercise(st);
  if (!built) return [h('p', {}, 'No tunes yet.')];
  const { ex, tune, parts, phrases } = built;
  const tunes = allTunes();
  const partOpts = [{ value: '-1', label: 'Whole tune' }, ...Array.from({ length: parts }, (_, i) => ({ value: String(i), label: `${String.fromCharCode(65 + i)} part` }))];
  const isUser = !TUNES.some((t) => t.id === tune.id);
  return [
    h('div', { class: 'controls' },
      h('div', { class: 'control-row' },
        select('Tune', tune.id, tunes.map((t) => ({ value: t.id, label: t.title, group: TUNES.includes(t) ? 'Traditional' : 'Added by you' })), (tuneId) => { ms.part = -1; ms.phrase = -1; setState({ tuneId }); }),
        segmented('Part', String(ms.part), partOpts, (v) => { ms.part = Number(v); ms.phrase = -1; rerender(); }),
        ms.part >= 0 && phrases > 1
          ? segmented('Phrase', String(ms.phrase), [{ value: '-1', label: 'All' }, ...Array.from({ length: phrases }, (_, i) => ({ value: String(i), label: `Bars ${i * 2 + 1}–${i * 2 + 2}` }))], (v) => { ms.phrase = Number(v); rerender(); })
          : null,
        tune.capo ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: ms.useCapo, onchange: (e: Event) => { ms.useCapo = (e.target as HTMLInputElement).checked; rerender(); } }), `Capo ${tune.capo} (G shapes)`) : null,
      )),
    ...exerciseView(ex, tn, h('p', { class: 'lead' }, tune.note), [
      tune.source.url ? h('p', { class: 'meta source' }, 'Melody based on the transcription at ', h('a', { href: tune.source.url, target: '_blank', rel: 'noopener' }, tune.source.label), '.') : null,
      isUser ? h('button', { type: 'button', class: 'chip', onclick: () => removeUserTune(tune.id) }, 'Remove this tune') : null,
      addTuneForm(),
    ]),
  ];
}

function removeUserTune(id: string): void {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_KEY) ?? '[]') as { id: string; abc: string }[];
    saveUserTunes(raw.filter((t) => t.id !== id));
  } catch {
    /* nothing stored */
  }
  setState({ tuneId: TUNES[0].id });
}

let addError = '';

function addTuneForm(): HTMLElement {
  const area = h('textarea', { rows: 8, spellcheck: 'false', placeholder: 'X:1\nT:Tune name\nM:4/4\nL:1/8\nK:G\n|:"G"GABc dedB|...' });
  return h(
    'details',
    { class: 'add-tune disclosure info' },
    h('summary', {}, h('span', { class: 'disclosure-label' }, 'Add your own tune'), h('span', { class: 'disclosure-summary' }, 'Paste ABC notation')),
    h('p', { class: 'prose' }, 'Paste a tune in ABC, the text format most fiddle-tune sites offer for download. It is saved in this browser only. Chord symbols in quotes ("G") give it a backing track.'),
    area,
    addError ? h('p', { class: 'error' }, addError) : null,
    h('button', {
      type: 'button',
      class: 'chip strong',
      onclick: () => {
        const abc = (area as HTMLTextAreaElement).value.trim();
        const parsed = abc ? parseAbc(abc) : null;
        const count = parsed ? parsed.measures.reduce((a, m) => a + m.notes.length, 0) : 0;
        if (!parsed || count < 2 || !/^K:/m.test(abc)) {
          addError = 'That doesn\u2019t look like ABC: it needs at least a K: (key) line and some notes after it.';
          rerender();
          return;
        }
        let raw: { id: string; abc: string }[] = [];
        try {
          raw = JSON.parse(localStorage.getItem(USER_KEY) ?? '[]');
        } catch {
          raw = [];
        }
        const id = `user-${Date.now()}`;
        if (!saveUserTunes([...raw, { id, abc }])) {
          addError = 'This browser would not let the tune be saved.';
          rerender();
          return;
        }
        addError = '';
        ms.part = -1;
        ms.phrase = -1;
        setState({ tuneId: id });
      },
    }, 'Add tune'),
  );
}

function licksTab(st: State, tn: Tuning): (HTMLElement | null)[] {
  const ex = lickExercise(st);
  const lick = LICKS.find((l) => l.id === st.lickId) ?? LICKS[0];
  return [
    h('div', { class: 'controls' },
      h('div', { class: 'control-row' },
        select('Lick', lick.id, LICKS.map((l) => ({ value: l.id, label: l.name })), (lickId) => { ms.pick = LICKS.find((l) => l.id === lickId)?.picks ? 'pattern' : ms.pick; setState({ lickId }); })),
      h('div', { class: 'control-row' }, rootPicker(ms.lickKey, (k) => { ms.lickKey = k; rerender(); }, 'Key'))),
    ...exerciseView(ex, tn, h('p', { class: 'lead' }, lick.use), []),
  ];
}

function randomTab(tn: Tuning): (HTMLElement | null)[] {
  const r = ms.rnd;
  const ex = randomExercise(tn);
  return [
    h('div', { class: 'controls' },
      h('div', { class: 'control-row' }, rootPicker(r.key, (k) => { r.key = k; rerender(); }, 'Key')),
      h('div', { class: 'control-row' },
        select('Scale', r.scaleId, RANDOM_SCALES.map((id) => ({ value: id, label: scaleById(id).name })), (v) => { r.scaleId = v; rerender(); }),
        segmented('Bars', String(r.bars), ['2', '4', '8'].map((b) => ({ value: b, label: b })), (v) => { r.bars = Number(v); rerender(); }),
        segmented('Rhythm', r.rhythm, [{ value: 'quarters', label: 'Quarters' }, { value: 'eighths', label: 'Eighths' }, { value: 'mixed', label: 'Mixed' }], (v) => { r.rhythm = v; rerender(); }),
        h('button', { type: 'button', class: 'chip strong', onclick: () => { r.seed++; lastResult = null; rerender(); } }, 'New melody'),
      )),
    ...exerciseView(ex, tn, h('p', { class: 'lead' }, 'Read it from the tab and play it, then try singing it before you play it again.'), []),
  ];
}

/* ---------- Over the changes ---------- */

const CHANGES: { id: string; name: string; degrees: number[]; scale?: string }[] = [
  { id: 'three', name: 'I – IV – V – I', degrees: [1, 4, 5, 1] },
  { id: 'bluegrass8', name: 'Eight-bar bluegrass', degrees: [1, 1, 4, 1, 1, 5, 1, 1] },
  { id: 'blues', name: 'Twelve-bar blues', degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5] },
  { id: 'pop', name: 'I – V – vi – IV', degrees: [1, 5, 6, 4] },
  { id: 'ii-v-i', name: 'ii – V – I', degrees: [2, 5, 1, 1] },
  { id: 'fifties', name: 'I – vi – IV – V', degrees: [1, 6, 4, 5] },
  { id: 'mixo', name: 'I – ♭VII – IV – I', degrees: [1, 7, 4, 1], scale: 'mixolydian' },
];

function changesTab(tn: Tuning): (HTMLElement | null)[] {
  const c = ms.ch;
  const prog = CHANGES.find((p) => p.id === c.prog) ?? CHANGES[0];
  const diatonic = harmonize(c.key, scaleById(prog.scale ?? 'ionian'), c.sevenths);
  // The blues sounds right with dominant 7ths on every chord.
  const chords = prog.degrees.map((d) => {
    const ch = diatonic[d - 1];
    if (prog.id === 'blues') return { root: ch.root, symbol: `${noteName(ch.root)}7` };
    return { root: ch.root, symbol: ch.symbol };
  });
  const beatsEach = 4 * c.barsEach;
  const spans = progressionSpans(chords.map((x) => x.symbol.replace('°', 'dim')), beatsEach);
  const length = chords.length * beatsEach;
  const opens = stringMidis(tn);
  const keyScale = scaleNotes(c.key, scaleById(prog.scale ?? 'ionian'));
  const keyPcs = new Map(keyScale.map((x) => [pc(x), x]));

  const neckFor = (spanIdx: number): SVGElement => {
    const span = spans[Math.min(spanIdx, spans.length - 1)];
    const tones = chordNotes(span.root, span.chord);
    const marks: NeckMark[] = [];
    tn.strings.forEach((_, str) => {
      for (let f = 0; f <= 15; f++) {
        const p = (opens[str] + f) % 12;
        const ti = tones.findIndex((x) => pc(x) === p);
        const isThird = ti === 1;
        if (ti >= 0 && (c.show === 'tones' || isThird)) {
          const iv = span.chord.formula[ti];
          marks.push({ string: str, fret: f, cls: `${degreeClass(iv)} ${ti === 0 ? 'root' : ''}`, label: intervalLabel(iv) });
        } else if (keyPcs.has(p)) {
          marks.push({ string: str, fret: f, cls: 'scale-tone', label: '' });
        }
      }
    });
    return neckSvg(tn, 15, marks);
  };

  const neckBox = h('div', { class: 'neck-scroll changes-neck' }, neckFor(0));
  const chart = h('ol', { class: 'chord-chart' },
    ...spans.map((sp, i) => h('li', { 'data-span': String(i), style: `flex-grow:${(sp.end - sp.start) / 4}` }, sp.symbol.replace('dim', '°'))));

  const showSpan = (i: number) => {
    neckBox.replaceChildren(neckFor(i));
    chart.querySelectorAll('li').forEach((li, k) => li.classList.toggle('now', k === i));
  };

  if (!gradingActive) {
    metro.setTrack({
      label: `${prog.name} in ${noteName(c.key)}`,
      beatsPerBar: 4,
      countIn: ms.countIn ? 1 : 0,
      schedule(from, to, time) {
        if (to <= 0) return;
        const lo = Math.max(0, from);
        scheduleBacking(spans, 4, length, lo, to, time);
        spans.forEach((sp, i) => {
          for (let k = Math.floor(lo / length); k <= Math.floor((to - 1e-9) / length); k++) {
            const b = sp.start + k * length;
            if (b >= lo - 1e-9 && b < to - 1e-9) metro.at(time(b), () => showSpan(i));
          }
        });
      },
    });
  }

  const running = metro.isRunning();
  return [
    h('div', { class: 'controls' },
      h('div', { class: 'control-row' }, rootPicker(c.key, (k) => { c.key = k; rerender(); }, 'Key')),
      h('div', { class: 'control-row' },
        select('Progression', prog.id, CHANGES.map((p) => ({ value: p.id, label: p.name })), (v) => { c.prog = v; rerender(); }),
        segmented('Bars per chord', String(c.barsEach), [{ value: '1', label: '1' }, { value: '2', label: '2' }], (v) => { c.barsEach = Number(v); rerender(); }),
        segmented('Show', c.show, [{ value: 'tones', label: 'Chord tones' }, { value: 'thirds', label: '3rds only' }], (v) => { c.show = v; rerender(); }),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: c.sevenths, onchange: (e: Event) => { c.sevenths = (e.target as HTMLInputElement).checked; rerender(); } }), 'Seventh chords'),
      )),
    h('div', { class: 'title-row' }, h('h2', {}, `${prog.name} in ${noteName(c.key)}`)),
    h('div', { class: 'melody-play' },
      h('button', {
        type: 'button',
        id: 'melody-go',
        class: `metro-go ${running ? 'on' : ''}`,
        onclick: () => (metro.isRunning() ? metro.stop() : metro.start()),
      }, running ? 'Stop' : 'Play'),
      h('div', { class: 'tempo' },
        h('button', { type: 'button', class: 'step', 'aria-label': 'Slower', onclick: () => metro.update({ bpm: metro.settings.bpm - 5 }) }, '−'),
        h('output', { class: 'bpm' }, h('b', { id: 'melody-bpm' }, String(running ? metro.currentTempo() : metro.settings.bpm)), h('small', {}, 'BPM')),
        h('button', { type: 'button', class: 'step', 'aria-label': 'Faster', onclick: () => metro.update({ bpm: metro.settings.bpm + 5 }) }, '+')),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: ms.countIn, onchange: (e: Event) => { ms.countIn = (e.target as HTMLInputElement).checked; rerender(); } }), 'Count-in bar'),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: metro.settings.click, onchange: (e: Event) => metro.update({ click: (e.target as HTMLInputElement).checked }) }), 'Click'),
    ),
    chart,
    neckBox,
    h('div', { class: 'prose' },
      h('p', {}, 'Play along with the boom-chuck backing. The neck shows the current chord\u2019s tones, labeled by their place in the chord, with the rest of the key in grey. Aim to land on a chord tone, ideally the 3rd, right as each new chord arrives.'),
      h('p', {}, 'Bluegrass breaks follow the melody, but they lean on chord tones in exactly this way, which is why outlining the changes makes a break sound like the song.')),
  ];
}

/* ---------- Page ---------- */

export function renderMelody(root: HTMLElement, st: State = getState()): void {
  container = root;
  const { tuning: tn } = getTuning(st);
  const tab = st.melodyTab;
  let body: (HTMLElement | null)[];
  if (tab === 'warmups') body = warmupsTab(st, tn);
  else if (tab === 'licks') body = licksTab(st, tn);
  else if (tab === 'random') body = randomTab(tn);
  else if (tab === 'changes') body = changesTab(tn);
  else body = tunesTab(st, tn);
  root.replaceChildren(
    pageTitle('Melody', 'Warm-ups, fiddle tunes, licks and improvising, with tab you can play along to.'),
    h('div', { class: 'controls' },
      h('div', { class: 'control-row' },
        pageTabs('Melody section', tab, [
          { value: 'warmups', label: 'Warm-ups' },
          { value: 'tunes', label: 'Fiddle tunes' },
          { value: 'licks', label: 'Licks' },
          { value: 'random', label: 'Random melody' },
          { value: 'changes', label: 'Over the changes' },
        ], (melodyTab) => { metro.stop(); setState({ melodyTab }); }))),
    ...body.filter((x): x is HTMLElement => x !== null),
  );
}

/* Keep the play button and tempo readout in step with the engine without a full re-render. */
let micUnsub: (() => void) | null = null;
metro.onChange(() => {
  if (getState().view !== 'melody') return;
  const bpm = document.querySelector('#melody-bpm');
  if (bpm && !metro.isRunning()) bpm.textContent = String(metro.settings.rampOn ? metro.settings.ramp.from : metro.settings.bpm);
  const go = document.querySelector<HTMLButtonElement>('#melody-go');
  if (go) {
    const on = metro.isRunning() && !gradingActive;
    go.textContent = on ? 'Stop' : 'Play';
    go.classList.toggle('on', on);
    go.disabled = gradingActive;
  }
  if (!metro.isRunning()) markNow(null);
  // Show what the microphone hears while grading.
  if (gradingActive && !micUnsub) {
    micUnsub = mic.onFrame((f) => {
      const el = document.querySelector('#mic-hearing');
      if (el) el.textContent = f.midi !== null ? `Hearing ${noteName(spellPc(f.midi))}${Math.floor(f.midi / 12) - 1}` : 'Listening…';
    });
  } else if (!gradingActive && micUnsub) {
    micUnsub();
    micUnsub = null;
  }
});
metro.onTick((e) => {
  const out = document.querySelector('#melody-bpm');
  if (out) out.textContent = String(e.bpm);
});

