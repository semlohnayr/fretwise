import { getState, setState, subscribe, fromHash, type State, type View } from './state';
import { noteName } from './theory';
import { renderCircle } from './ui/circle';
import { renderFretboard } from './ui/fretboard';
import { renderModes } from './ui/modes';
import { renderCapo } from './ui/capo';
import { renderMelody } from './ui/melody';
import { renderSessions } from './ui/sessions';
import { initSessionBar } from './ui/sessionbar';
import { renderPractice } from './ui/practice';
import { isMuted, setMuted, onMuteChange, audioSupported } from './audio';
import { initMetronome } from './ui/metronome';
import { setTrack } from './metronome';

const VIEWS: { id: View; label: string }[] = [
  { id: 'circle', label: 'Circle of fifths' },
  { id: 'fretboard', label: 'Fretboard' },
  { id: 'modes', label: 'Modes' },
  { id: 'melody', label: 'Melody' },
  { id: 'capo', label: 'Capo' },
  { id: 'practice', label: 'Practice' },
  { id: 'sessions', label: 'Sessions' },
];

const nav = document.querySelector<HTMLElement>('#views')!;
const main = document.querySelector<HTMLElement>('#main')!;
const context = document.querySelector<HTMLElement>('#context')!;

let lastView: View | null = null;

function render(st: State): void {
  nav.replaceChildren(
    ...VIEWS.map((v) => {
      const a = document.createElement('a');
      a.href = `#${v.id}`;
      a.textContent = v.label;
      if (v.id === st.view) a.setAttribute('aria-current', 'page');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setState({ view: v.id });
      });
      return a;
    }),
  );
  context.parentElement!.hidden = st.view === 'capo' || st.view === 'practice' || st.view === 'melody' || st.view === 'sessions';
  context.textContent = `${noteName(st.root)}${st.keyQuality === 'minor' && st.view === 'circle' ? ' minor' : ''}`;

  // Keep focus and scroll stable when re-rendering the same view.
  const focusedLabel = document.activeElement?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent;
  const scroller = main.querySelector('.neck-scroll');
  const neckScroll = scroller?.scrollLeft ?? 0;

  // Only the fretboard and melody pages supply something to play along with.
  if (st.view !== 'fretboard' && st.view !== 'melody') setTrack(null);
  if (st.view === 'circle') renderCircle(main, st);
  else if (st.view === 'fretboard') renderFretboard(main, st);
  else if (st.view === 'modes') renderModes(main, st);
  else if (st.view === 'melody') renderMelody(main, st);
  else if (st.view === 'capo') renderCapo(main, st);
  else if (st.view === 'sessions') renderSessions(main, st);
  else renderPractice(main, st);

  if (lastView !== st.view) {
    window.scrollTo({ top: 0 });
    main.focus({ preventScroll: true });
  } else {
    const newScroller = main.querySelector('.neck-scroll');
    if (newScroller) newScroller.scrollLeft = neckScroll;
    if (focusedLabel) {
      const match = [...main.querySelectorAll<HTMLElement>('button, [role=button], select, input')].find(
        (el) => (el.getAttribute('aria-label') ?? el.textContent) === focusedLabel,
      );
      match?.focus({ preventScroll: true });
    }
  }
  lastView = st.view;
}

// Sound toggle in the header.
const sound = document.querySelector<HTMLButtonElement>('#sound')!;
const paintSound = (m: boolean) => {
  sound.setAttribute('aria-pressed', String(!m));
  sound.querySelector('span')!.textContent = m ? 'Sound off' : 'Sound on';
};
if (!audioSupported()) sound.hidden = true;
paintSound(isMuted());
sound.addEventListener('click', () => setMuted(!isMuted()));
onMuteChange((m) => {
  paintSound(m);
  render(getState());
});

initMetronome();
initSessionBar();
subscribe(render);
// Pasted or edited links (and back/forward) update the app without a reload.
window.addEventListener('hashchange', () => setState(fromHash()));
render(getState());
