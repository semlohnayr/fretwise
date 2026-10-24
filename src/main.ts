import { getState, setState, subscribe, fromHash, type State, type View } from './state';
import { renderCircle } from './ui/circle';
import { renderFretboard } from './ui/fretboard';
import { renderModes } from './ui/modes';
import { renderCapo } from './ui/capo';
import { renderMelody } from './ui/melody';
import { renderShapes } from './ui/shapes';
import { renderInstruments } from './ui/instruments';
import { renderSessions } from './ui/sessions';
import { initSessionBar } from './ui/sessionbar';
import { renderPractice } from './ui/practice';
import { isMuted, setMuted, onMuteChange, audioSupported } from './audio';
import { initMetronome } from './ui/metronome';
import { setTrack } from './metronome';

/**
 * Two groups: reference tools for looking things up, then pages for playing.
 * (Route ids stay as they were so old links keep working; "practice" is the
 * quiz page and "sessions" is the practice-plan page.)
 */
const NAV: { group: string; views: { id: View; label: string; title: string }[] }[] = [
  {
    group: 'Learn',
    views: [
      { id: 'circle', label: 'Circle', title: 'Circle of fifths, keys and chords' },
      { id: 'fretboard', label: 'Fretboard', title: 'Scales, chords, triads and patterns on the neck' },
      { id: 'modes', label: 'Modes', title: 'The seven modes compared' },
      { id: 'shapes', label: 'Chord chart', title: 'Every movable CAGED chord shape on one printable page' },
      { id: 'instruments', label: 'Mandolin & bass', title: 'Scales, chop chords, arpeggios and bass lines for mandolin and bass guitar' },
      { id: 'capo', label: 'Capo', title: 'Capo calculator' },
    ],
  },
  {
    group: 'Play',
    views: [
      { id: 'melody', label: 'Melody', title: 'Warm-ups, fiddle tunes, licks and improvising' },
      { id: 'practice', label: 'Quizzes', title: 'Note, interval and ear-training quizzes' },
      { id: 'sessions', label: 'Practice', title: 'Timed practice plans and your practice log' },
    ],
  },
];

const nav = document.querySelector<HTMLElement>('#views')!;
const main = document.querySelector<HTMLElement>('#main')!;

let lastView: View | null = null;

/* On phones the page list folds into a menu button that shows the current page. */
const headerEl = document.querySelector<HTMLElement>('header.top')!;
const pagesToggle = document.querySelector<HTMLButtonElement>('#pages-toggle')!;
const svgIcon = (d: string, cls: string) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 16 16');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', cls);
  el.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  return el;
};
const menuIcon = () => svgIcon('M2.5 4h11M2.5 8h11M2.5 12h11', 'menu-icon');
const chevron = () => svgIcon('M4.5 6.5 8 10l3.5-3.5', 'chevron');
function setMenu(open: boolean): void {
  headerEl.classList.toggle('pages-open', open);
  pagesToggle.setAttribute('aria-expanded', String(open));
}
pagesToggle.addEventListener('click', () => setMenu(!headerEl.classList.contains('pages-open')));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && headerEl.classList.contains('pages-open')) {
    setMenu(false);
    pagesToggle.focus();
  }
});

function render(st: State): void {
  nav.replaceChildren(
    ...NAV.map((g) => {
      const group = document.createElement('div');
      group.className = 'nav-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', g.group);
      // Group names and descriptions show only in the phone menu.
      const name = document.createElement('span');
      name.className = 'nav-group-name';
      name.textContent = g.group;
      name.setAttribute('aria-hidden', 'true');
      group.append(name);
      for (const v of g.views) {
        const a = document.createElement('a');
        a.href = `#${v.id}`;
        const label = document.createElement('span');
        label.textContent = v.label;
        const desc = document.createElement('small');
        desc.textContent = v.title;
        a.append(label, desc);
        a.title = v.title;
        if (v.id === st.view) a.setAttribute('aria-current', 'page');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          setMenu(false);
          setState({ view: v.id });
        });
        group.append(a);
      }
      return group;
    }),
  );
  const current = NAV.flatMap((g) => g.views).find((v) => v.id === st.view);
  pagesToggle.replaceChildren(menuIcon(), document.createTextNode(current?.label ?? 'Pages'), chevron());
  pagesToggle.setAttribute('aria-label', `Pages menu, now on ${current?.label ?? 'a page'}`);
  // Keep the current page's link in view when the nav scrolls sideways on a phone.
  nav.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  // Keep focus and scroll stable when re-rendering the same view.
  const focusedLabel = document.activeElement?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.textContent;
  const scroller = main.querySelector('.neck-scroll');
  const neckScroll = scroller?.scrollLeft ?? 0;

  // Only the fretboard and melody pages supply something to play along with.
  if (st.view !== 'fretboard' && st.view !== 'melody' && st.view !== 'instruments') setTrack(null);
  if (st.view === 'circle') renderCircle(main, st);
  else if (st.view === 'fretboard') renderFretboard(main, st);
  else if (st.view === 'modes') renderModes(main, st);
  else if (st.view === 'melody') renderMelody(main, st);
  else if (st.view === 'shapes') renderShapes(main);
  else if (st.view === 'instruments') renderInstruments(main, st);
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
  sound.setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
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
// Rotating a phone or resizing across the phone breakpoint switches the neck between upright and level.
matchMedia('(max-width: 600px)').addEventListener('change', () => render(getState()));
// Pasted or edited links (and back/forward) update the app without a reload.
window.addEventListener('hashchange', () => setState(fromHash()));
render(getState());
