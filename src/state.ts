import { type Note, type BassStyle, n, noteName, SCALES, CHORDS } from './theory';

export type View = 'circle' | 'fretboard' | 'modes' | 'shapes' | 'instruments' | 'melody' | 'capo' | 'practice' | 'sessions';
export type Pattern = 'none' | 'caged' | '3nps';
export type QuizKind = 'note' | 'fret-interval' | 'ear-interval' | 'ear-chord';
export type MelodyTab = 'warmups' | 'tunes' | 'licks' | 'random' | 'changes';
export type FretMode = 'scale' | 'chord' | 'caged' | 'triads' | 'notes';
export type LabelMode = 'names' | 'intervals' | 'none';

export interface State {
  view: View;
  /** Shared root note across all views. */
  root: Note;
  /** Key quality selected on the circle. */
  keyQuality: 'major' | 'minor';
  scaleId: string;
  chordId: string;
  fretMode: FretMode;
  labels: LabelMode;
  tuningId: string;
  customTuning: string;
  frets: number;
  /** Scale/chord pattern overlay on the fretboard. */
  pattern: Pattern;
  /** Which CAGED shape to focus: every shape, or one. */
  caged: 'all' | 'C' | 'A' | 'G' | 'E' | 'D';
  /** Three-notes-per-string position, 1–7. */
  npsPosition: number;
  /** Selected chord voicing, identified by its tab name (e.g. "x32010"). */
  voicing: string | null;
  /* Capo calculator */
  capoTarget: Note;
  capoQuality: 'major' | 'minor';
  capoShape: string;
  capoFret: number;
  /* Practice */
  quiz: QuizKind;
  /* Melody */
  melodyTab: MelodyTab;
  tuneId: string;
  lickId: string;
  warmupId: string;
  /** Triad string set, as index of the lowest string. */
  triadSet: number;
  modesView: 'parallel' | 'relative';
  /* Mandolin & bass */
  instrument: 'mandolin' | 'bass';
  bassStrings: 4 | 5;
  instShow: 'scale' | 'chord';
  /** Mandolin position start fret, or -1 for the whole neck. */
  mandoPos: number;
  /** Selected mandolin grip, as its fret list (e.g. "0023"). */
  instGrip: string | null;
  /** Bass arpeggio box: the root string, or -1 for the whole neck. */
  bassBox: number;
  bassStyle: BassStyle;
  bassProg: number;
}

const initial: State = {
  view: 'circle',
  root: n('G'),
  keyQuality: 'major',
  scaleId: 'ionian',
  chordId: 'maj',
  fretMode: 'scale',
  labels: 'intervals',
  tuningId: 'standard',
  customTuning: 'E A D G B E',
  frets: 15,
  pattern: 'none',
  caged: 'all',
  npsPosition: 1,
  voicing: null,
  capoTarget: n('A'),
  capoQuality: 'major',
  capoShape: 'G',
  capoFret: 2,
  quiz: 'note',
  melodyTab: 'tunes',
  tuneId: 'soldiers-joy',
  lickId: 'g-run',
  warmupId: 'open-strings',
  triadSet: 3,
  modesView: 'parallel',
  instrument: 'mandolin',
  bassStrings: 4,
  instShow: 'scale',
  mandoPos: -1,
  instGrip: null,
  bassBox: -1,
  bassStyle: 'root-five',
  bassProg: 0,
};

type Listener = (s: State) => void;
const listeners: Listener[] = [];
let state: State = { ...initial, ...fromHash() };

export const getState = (): State => state;

export function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
  writeHash();
  listeners.forEach((l) => l(state));
}

export function subscribe(l: Listener): void {
  listeners.push(l);
}

/* The URL hash keeps the view, root, scale and chord so a link reopens the same page. */

function writeHash(): void {
  const p = new URLSearchParams({
    root: noteName(state.root, true),
    scale: state.scaleId,
    chord: state.chordId,
    mode: state.fretMode,
  });
  if (state.view === 'instruments') p.set('inst', state.instrument);
  history.replaceState(null, '', `#${state.view}?${p.toString()}`);
}

export function fromHash(): Partial<State> {
  if (typeof location === 'undefined') return {};
  const [view, query = ''] = location.hash.replace(/^#/, '').split('?');
  const p = new URLSearchParams(query);
  const out: Partial<State> = {};
  if (view === 'circle' || view === 'fretboard' || view === 'modes' || view === 'shapes' || view === 'instruments' || view === 'melody' || view === 'capo' || view === 'practice' || view === 'sessions') out.view = view;
  try {
    if (p.get('root')) out.root = n(p.get('root')!);
  } catch {
    /* ignore a malformed root */
  }
  const scale = p.get('scale');
  if (scale && SCALES.some((x) => x.id === scale)) out.scaleId = scale;
  const chord = p.get('chord');
  if (chord && CHORDS.some((x) => x.id === chord)) out.chordId = chord;
  const mode = p.get('mode');
  if (mode === 'scale' || mode === 'chord' || mode === 'caged' || mode === 'triads' || mode === 'notes') out.fretMode = mode;
  const inst = p.get('inst');
  if (inst === 'mandolin' || inst === 'bass') out.instrument = inst;
  return out;
}
