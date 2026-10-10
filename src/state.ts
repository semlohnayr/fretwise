import { type Note, n, noteName, SCALES, CHORDS } from './theory';

export type View = 'circle' | 'fretboard' | 'modes';
export type FretMode = 'scale' | 'chord' | 'triads' | 'notes';
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
  /** 'all' = show every CAGED shape, 'off' = disabled, or one shape. */
  caged: 'off' | 'all' | 'C' | 'A' | 'G' | 'E' | 'D';
  /** Triad string set, as index of the lowest string. */
  triadSet: number;
  modesView: 'parallel' | 'relative';
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
  caged: 'off',
  triadSet: 3,
  modesView: 'parallel',
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
  history.replaceState(null, '', `#${state.view}?${p.toString()}`);
}

export function fromHash(): Partial<State> {
  if (typeof location === 'undefined') return {};
  const [view, query = ''] = location.hash.replace(/^#/, '').split('?');
  const p = new URLSearchParams(query);
  const out: Partial<State> = {};
  if (view === 'circle' || view === 'fretboard' || view === 'modes') out.view = view;
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
  if (mode === 'scale' || mode === 'chord' || mode === 'triads' || mode === 'notes') out.fretMode = mode;
  return out;
}
