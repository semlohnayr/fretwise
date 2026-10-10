import { getState, setState, subscribe, fromHash, type State, type View } from './state';
import { noteName } from './theory';
import { renderCircle } from './ui/circle';
import { renderFretboard } from './ui/fretboard';
import { renderModes } from './ui/modes';

const VIEWS: { id: View; label: string }[] = [
  { id: 'circle', label: 'Circle of fifths' },
  { id: 'fretboard', label: 'Fretboard' },
  { id: 'modes', label: 'Modes' },
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
  context.textContent = `${noteName(st.root)}${st.keyQuality === 'minor' && st.view === 'circle' ? ' minor' : ''}`;

  // Keep focus and scroll stable when re-rendering the same view.
  const focusedLabel = document.activeElement?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent;
  const scroller = main.querySelector('.neck-scroll');
  const neckScroll = scroller?.scrollLeft ?? 0;

  if (st.view === 'circle') renderCircle(main, st);
  else if (st.view === 'fretboard') renderFretboard(main, st);
  else renderModes(main, st);

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

subscribe(render);
// Pasted or edited links (and back/forward) update the app without a reload.
window.addEventListener('hashchange', () => setState(fromHash()));
render(getState());
