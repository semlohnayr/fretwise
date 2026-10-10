import {
  type Rng, INTERVAL_CHOICES, BASIC_INTERVALS, QUIZ_CHORDS, CHORDS, ROOT_CHOICES,
  noteFindQuestion, fretIntervalQuestion, earIntervalQuestion, chordQuizQuestion,
  noteName, pc, spellPc, stringMidis, tuningLabel,
} from '../theory';
import { getState, setState, type State, type QuizKind } from '../state';
import { h, segmented } from './dom';
import { playButton } from './controls';
import { getTuning, neckSvg } from './fretboard';
import { playNote, playChord, playSequence, isMuted } from '../audio';

const rng: Rng = Math.random;

/* ---------- Session state (not in the URL) ---------- */

interface Score {
  right: number;
  total: number;
  streak: number;
}

interface Settings {
  naturalsOnly: boolean;
  maxFret: number;
  intervalSet: 'basic' | 'all';
  harmonic: boolean;
  chordSet: 'triads' | 'sevenths';
}

const settings: Settings = { naturalsOnly: true, maxFret: 12, intervalSet: 'basic', harmonic: false, chordSet: 'triads' };
const scores: Record<QuizKind, Score> = {
  note: { right: 0, total: 0, streak: 0 },
  'fret-interval': { right: 0, total: 0, streak: 0 },
  'ear-interval': { right: 0, total: 0, streak: 0 },
  'ear-chord': { right: 0, total: 0, streak: 0 },
};

type Question =
  | { kind: 'note'; string: number; fret: number; answer: number }
  | { kind: 'fret-interval'; low: { string: number; fret: number }; high: { string: number; fret: number }; answer: number }
  | { kind: 'ear-interval'; lowMidi: number; answer: number; harmonic: boolean }
  | { kind: 'ear-chord'; rootMidi: number; answer: string };

let question: Question | null = null;
/** The answer the player picked for the current question, once they have answered. */
let picked: string | null = null;
let container: HTMLElement | null = null;
let advanceTimer: number | undefined;
/** Whether the current ear question has already been played automatically. */
let autoPlayed = false;

const BEST_KEY = 'fretwise:best-streaks';

function bestStreaks(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function saveBest(kind: QuizKind, streak: number): void {
  const all = bestStreaks();
  if (streak <= (all[kind] ?? 0)) return;
  all[kind] = streak;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable; the best streak just won't persist */
  }
}

const intervalPool = (): number[] => (settings.intervalSet === 'basic' ? BASIC_INTERVALS : INTERVAL_CHOICES.map((i) => i.semitones));
const chordPool = (): string[] => (settings.chordSet === 'triads' ? ['maj', 'min', 'dim', 'aug'] : QUIZ_CHORDS);

function newQuestion(kind: QuizKind, st: State): Question {
  const { tuning } = getTuning(st);
  const frets = Math.min(settings.maxFret, st.frets);
  switch (kind) {
    case 'note': {
      const q = noteFindQuestion(rng, tuning, frets, settings.naturalsOnly);
      return { kind, ...q };
    }
    case 'fret-interval': {
      const q = fretIntervalQuestion(rng, tuning, frets, intervalPool());
      return { kind, ...q };
    }
    case 'ear-interval': {
      const q = earIntervalQuestion(rng, intervalPool(), settings.harmonic);
      return { kind, ...q };
    }
    case 'ear-chord': {
      const q = chordQuizQuestion(rng, chordPool());
      return { kind, rootMidi: q.rootMidi, answer: q.chord.id };
    }
  }
}

function playQuestion(q: Question, st: State): void {
  if (q.kind === 'ear-interval') {
    const notes = [q.lowMidi, q.lowMidi + q.answer];
    if (q.harmonic) playChord(notes, 0, 0);
    else playSequence(notes, 0.7);
  } else if (q.kind === 'ear-chord') {
    const chord = CHORDS.find((c) => c.id === q.answer)!;
    playChord(chord.formula.map((i) => q.rootMidi + i.semitones), 0, 0.05);
  } else if (q.kind === 'note' || q.kind === 'fret-interval') {
    const opens = stringMidis(getTuning(st).tuning);
    if (q.kind === 'note') playNote(opens[q.string] + q.fret);
    else playSequence([opens[q.low.string] + q.low.fret, opens[q.high.string] + q.high.fret], 0.6);
  }
}

function answerKey(q: Question): string {
  return String(q.answer);
}

function choose(kind: QuizKind, value: string): void {
  if (!question || picked !== null) return;
  picked = value;
  const sc = scores[kind];
  sc.total++;
  if (value === answerKey(question)) {
    sc.right++;
    sc.streak++;
    saveBest(kind, sc.streak);
    // Move on by itself after a correct answer.
    advanceTimer = window.setTimeout(() => next(kind), 900);
  } else {
    sc.streak = 0;
  }
  // Fretboard quizzes play the notes after answering, so the ear learns alongside the eye.
  if (question.kind === 'note' || question.kind === 'fret-interval') playQuestion(question, getState());
  rerender();
}

function next(kind: QuizKind): void {
  window.clearTimeout(advanceTimer);
  const st = getState();
  question = newQuestion(kind, st);
  picked = null;
  rerender();
  autoPlayed = question.kind === 'ear-interval' || question.kind === 'ear-chord';
  if (autoPlayed) playQuestion(question, st);
}

function rerender(): void {
  if (container && getState().view === 'practice') renderPractice(container);
}

/* ---------- Rendering ---------- */

const QUIZZES: { value: QuizKind; label: string }[] = [
  { value: 'note', label: 'Find the note' },
  { value: 'fret-interval', label: 'Intervals on the neck' },
  { value: 'ear-interval', label: 'Intervals by ear' },
  { value: 'ear-chord', label: 'Chords by ear' },
];

const INTRO: Record<QuizKind, string> = {
  note: 'Name the highlighted note. Start with natural notes only; add sharps and flats once the naturals come quickly.',
  'fret-interval': 'Name the interval from the lower note (1) up to the higher one (2). Learning interval shapes lets you find chord tones and harmonies anywhere on the neck.',
  'ear-interval': 'Listen to two notes and name the distance between them. Melodic plays them one after the other; harmonic plays them together.',
  'ear-chord': 'Listen to a chord and name its quality. Major sounds bright, minor dark, diminished tense and augmented unresolved.',
};

function settingsRow(kind: QuizKind): HTMLElement {
  const set = (patch: Partial<Settings>) => {
    Object.assign(settings, patch);
    next(kind);
  };
  const items: HTMLElement[] = [];
  if (kind === 'note') {
    items.push(
      segmented('Notes', settings.naturalsOnly ? 'nat' : 'all', [{ value: 'nat', label: 'Naturals' }, { value: 'all', label: 'All 12' }], (v) => set({ naturalsOnly: v === 'nat' })),
    );
  }
  if (kind === 'note' || kind === 'fret-interval') {
    items.push(segmented('Frets', String(settings.maxFret), ['5', '12', '15'].map((f) => ({ value: f, label: `0–${f}` })), (v) => set({ maxFret: Number(v) })));
  }
  if (kind === 'fret-interval' || kind === 'ear-interval') {
    items.push(segmented('Intervals', settings.intervalSet, [{ value: 'basic', label: '3rds, 4th, 5th, octave' }, { value: 'all', label: 'All' }], (v) => set({ intervalSet: v })));
  }
  if (kind === 'ear-interval') {
    items.push(segmented('Play', settings.harmonic ? 'h' : 'm', [{ value: 'm', label: 'Melodic' }, { value: 'h', label: 'Harmonic' }], (v) => set({ harmonic: v === 'h' })));
  }
  if (kind === 'ear-chord') {
    items.push(segmented('Chords', settings.chordSet, [{ value: 'triads', label: 'Triads' }, { value: 'sevenths', label: 'With 7ths' }], (v) => set({ chordSet: v })));
  }
  return h('div', { class: 'control-row' }, ...items);
}

function answerButtons(kind: QuizKind, q: Question): HTMLElement {
  let options: { value: string; label: string }[];
  if (kind === 'note') {
    options = ROOT_CHOICES.map((r) => {
      const p = pc(r);
      const sharp = noteName(spellPc(p));
      const flat = noteName(spellPc(p, true));
      return { value: String(p), label: sharp === flat ? sharp : `${sharp}/${flat}` };
    }).filter((o) => !settings.naturalsOnly || !o.label.includes('/'));
  } else if (kind === 'ear-chord') {
    options = chordPool().map((id) => ({ value: id, label: CHORDS.find((c) => c.id === id)!.name }));
  } else {
    const pool = intervalPool();
    options = INTERVAL_CHOICES.filter((i) => pool.includes(i.semitones)).map((i) => ({ value: String(i.semitones), label: i.name }));
  }
  const correct = answerKey(q);
  return h(
    'div',
    { class: 'answers', role: 'group', 'aria-label': 'Answers' },
    ...options.map((o) => {
      const state = picked === null ? '' : o.value === correct ? 'right' : o.value === picked ? 'wrong' : 'dim';
      return h('button', { type: 'button', class: state, disabled: picked !== null && o.value !== correct && o.value !== picked, onclick: () => choose(kind, o.value) }, o.label);
    }),
  );
}

function prompt(q: Question, st: State): HTMLElement {
  const { tuning } = getTuning(st);
  const frets = Math.min(settings.maxFret, st.frets);
  if (q.kind === 'note') {
    const reveal = picked !== null ? noteName(spellPc(q.answer)) : '?';
    return h('div', { class: 'neck-scroll' }, neckSvg(tuning, Math.max(frets, 5), [{ string: q.string, fret: q.fret, cls: 'deg-1 root', label: reveal }]));
  }
  if (q.kind === 'fret-interval') {
    return h('div', { class: 'neck-scroll' },
      neckSvg(tuning, Math.max(frets, 5), [
        { string: q.low.string, fret: q.low.fret, cls: 'deg-1 root', label: '1' },
        { string: q.high.string, fret: q.high.fret, cls: 'deg-5', label: '2' },
      ]));
  }
  return h('div', { class: 'ear-prompt' },
    playButton(autoPlayed ? 'Play again' : 'Play', () => playQuestion(q, st), 'big'),
    isMuted() ? h('p', { class: 'error' }, 'Sound is off. Turn it on with the Sound button at the top of the page.') : null);
}

function feedback(kind: QuizKind, q: Question): HTMLElement | null {
  if (picked === null) return null;
  const right = picked === answerKey(q);
  let correct = '';
  if (q.kind === 'note') correct = noteName(spellPc(q.answer));
  else if (q.kind === 'ear-chord') correct = CHORDS.find((c) => c.id === q.answer)!.name;
  else correct = INTERVAL_CHOICES.find((i) => i.semitones === q.answer)!.name;
  return h(
    'div',
    { class: `feedback ${right ? 'ok' : 'no'}`, role: 'status' },
    h('p', {}, right ? `Correct: ${correct}.` : `It was ${correct}.`),
    right ? null : h('button', { type: 'button', class: 'chip strong', onclick: () => next(kind) }, 'Next question'),
  );
}

export function renderPractice(root: HTMLElement, st: State = getState()): void {
  container = root;
  const kind = st.quiz;
  if (!question || question.kind !== kind) {
    question = newQuestion(kind, st);
    picked = null;
    autoPlayed = false;
  }
  const sc = scores[kind];
  const best = bestStreaks()[kind] ?? 0;
  const pct = sc.total ? Math.round((100 * sc.right) / sc.total) : 0;
  const isEar = kind === 'ear-interval' || kind === 'ear-chord';

  root.replaceChildren(
    h('div', { class: 'controls' },
      h('div', { class: 'control-row' },
        segmented('Practice', kind, QUIZZES, (quiz) => {
          window.clearTimeout(advanceTimer);
          setState({ quiz });
        })),
      settingsRow(kind)),
    h(
      'section',
      { class: 'quiz' },
      h('div', { class: 'quiz-head' },
        h('p', { class: 'prose' }, INTRO[kind]),
        h('dl', { class: 'score' },
          h('div', {}, h('dt', {}, 'Score'), h('dd', {}, sc.total ? `${sc.right}/${sc.total} (${pct}%)` : '–')),
          h('div', {}, h('dt', {}, 'Streak'), h('dd', {}, String(sc.streak))),
          h('div', {}, h('dt', {}, 'Best streak'), h('dd', {}, String(best))))),
      prompt(question, st),
      isEar && !autoPlayed ? h('p', { class: 'hint' }, 'Select Play to hear the question. After you answer, new questions play automatically.') : null,
      answerButtons(kind, question),
      feedback(kind, question),
      kind === 'note' || kind === 'fret-interval' ? h('p', { class: 'meta' }, `Tuning: ${tuningLabel(getTuning(st).tuning)}. Change it on the Fretboard page.`) : null,
    ),
  );
}
