/**
 * The bar under the header while a practice session runs: current step,
 * time left, and controls. It stays visible on every page.
 */
import * as session from '../session';
import type { StepOpen } from '../content/plans';
import { setState, type State } from '../state';
import { n } from '../theory';
import { h } from './dom';
import { focusMelody } from './melody';
import * as metro from '../metronome';

/** Go to the page (and exercise) a step is about. */
export function openStep(o: StepOpen): void {
  metro.stop();
  if (o.melody) focusMelody(o.melody);
  const patch: Partial<State> = { view: o.view };
  if (o.melodyTab) patch.melodyTab = o.melodyTab;
  if (o.warmupId) patch.warmupId = o.warmupId;
  if (o.tuneId) patch.tuneId = o.tuneId;
  if (o.lickId) patch.lickId = o.lickId;
  if (o.quiz) patch.quiz = o.quiz;
  if (o.fretMode) patch.fretMode = o.fretMode;
  if (o.scaleId) patch.scaleId = o.scaleId;
  if (o.chordId) patch.chordId = o.chordId;
  if (o.root) patch.root = n(o.root);
  if (o.pattern) patch.pattern = o.pattern;
  if (o.npsPosition) patch.npsPosition = o.npsPosition;
  if (o.caged) patch.caged = o.caged;
  if (o.modesView) patch.modesView = o.modesView;
  setState(patch);
}

let lastKey = '';

function render(bar: HTMLElement): void {
  const s = session.current();
  const plan = session.currentPlan();
  const step = session.currentStep();
  document.body.classList.toggle('session-on', !!s);
  bar.hidden = !s;
  if (!s || !plan || !step) {
    bar.replaceChildren();
    lastKey = '';
    return;
  }
  const timeUp = s.remaining === 0;
  // Most ticks only change the clock; update it in place so focus stays put.
  const key = `${s.planId}:${s.index}:${s.running}:${timeUp}`;
  if (key === lastKey) {
    const clock = bar.querySelector('.session-clock');
    if (clock) clock.textContent = timeUp ? 'Time\u2019s up' : session.formatClock(s.remaining);
    return;
  }
  lastKey = key;
  const last = s.index + 1 >= plan.steps.length;
  bar.replaceChildren(
    h('div', { class: `session-inner ${timeUp ? 'time-up' : ''}` },
      h('span', { class: 'session-step' }, `${plan.name}: step ${s.index + 1} of ${plan.steps.length}`),
      h('b', { class: 'session-title' }, step.title),
      h('span', { class: 'session-clock', 'aria-live': timeUp ? 'polite' : 'off' }, timeUp ? 'Time’s up' : session.formatClock(s.remaining)),
      h('div', { class: 'session-actions' },
        step.open ? h('button', { type: 'button', class: 'chip', onclick: () => openStep(step.open!) }, 'Go to exercise') : null,
        h('button', { type: 'button', class: 'chip', onclick: () => session.toggle() }, s.running ? 'Pause' : 'Resume'),
        h('button', {
          type: 'button',
          class: `chip ${timeUp ? 'strong' : ''}`,
          onclick: () => {
            session.next();
            const nextStep = session.currentStep();
            // Steps without an exercise (and the end of the session) show on the Sessions page.
            if (nextStep?.open) openStep(nextStep.open);
            else setState({ view: 'sessions' });
          },
        }, last ? 'Finish' : 'Next step'),
        h('button', { type: 'button', class: 'chip', onclick: () => { session.finish(); setState({ view: 'sessions' }); } }, 'End'),
      ),
    ),
  );
}

export function initSessionBar(): void {
  const bar = document.querySelector<HTMLElement>('#session-bar');
  if (!bar) return;
  // Re-render on every tick is cheap: it is one short line of controls.
  session.onSessionChange(() => render(bar));
  render(bar);
}
