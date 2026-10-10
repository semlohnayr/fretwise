/**
 * Sessions page: practice plans you can run step by step, warm-up advice,
 * and a log of what you have practiced.
 */
import { PLANS, PRACTICE_TIPS, planById, type Plan } from '../content/plans';
import * as session from '../session';
import { dailyMinutes, streak, weekMinutes } from '../sessionlog';
import { getState, type State } from '../state';
import { h } from './dom';
import { openStep } from './sessionbar';

let selected = PLANS[1].id;
let confirmClear = false;

function planCard(plan: Plan): HTMLElement {
  const total = session.planMinutes(plan).reduce((a, b) => a + b, 0);
  const on = plan.id === selected;
  return h('li', {},
    h('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': String(on), onclick: () => { selected = plan.id; rerender(); } },
      h('b', {}, plan.name),
      h('span', { class: 'plan-time' }, `${total} min, ${plan.steps.length} steps`),
      h('small', {}, plan.summary)));
}

function planDetail(plan: Plan): HTMLElement {
  const mins = session.planMinutes(plan);
  const total = mins.reduce((a, b) => a + b, 0);
  const running = session.current();
  const runningThis = running && running.planId === plan.id;
  const changed = mins.some((m, i) => m !== plan.steps[i].minutes);
  return h(
    'section',
    { class: 'plan-detail' },
    h('div', { class: 'title-row' },
      h('h2', {}, plan.name),
      h('span', { class: 'meta' }, `${total} minutes`),
      runningThis
        ? h('span', { class: 'capo-tag' }, 'Running')
        : h('button', { type: 'button', class: 'play', onclick: () => { session.start(plan.id); const first = plan.steps[0]; if (first.open) openStep(first.open); else rerender(); } },
          running ? 'Start this plan instead' : 'Start session')),
    h('p', { class: 'prose' }, plan.summary),
    h(
      'ol',
      { class: 'plan-steps' },
      ...plan.steps.map((step, i) => {
        const current = runningThis && running!.index === i;
        const done = runningThis && running!.index > i;
        return h('li', { class: `${current ? 'current' : ''} ${done ? 'done' : ''}` },
          h('div', { class: 'step-head' },
            h('b', {}, step.title),
            runningThis
              ? h('span', { class: 'meta' }, `${mins[i]} min`)
              : h('span', { class: 'step-minutes' },
                h('button', { type: 'button', class: 'step', 'aria-label': `Less time for ${step.title}`, onclick: () => session.setStepMinutes(plan, step.id, mins[i] - 1) }, '−'),
                h('span', {}, `${mins[i]} min`),
                h('button', { type: 'button', class: 'step', 'aria-label': `More time for ${step.title}`, onclick: () => session.setStepMinutes(plan, step.id, mins[i] + 1) }, '+')),
            step.open ? h('button', { type: 'button', class: 'chip', onclick: () => openStep(step.open!) }, 'Open') : null),
          h('p', {}, step.how));
      }),
    ),
    changed && !runningThis ? h('button', { type: 'button', class: 'chip', onclick: () => session.resetMinutes(plan) }, 'Reset times') : null,
  );
}

function logView(): HTMLElement {
  const log = session.readLog();
  const today = new Date();
  const days = dailyMinutes(log, today, 14);
  const max = Math.max(15, ...days.map((d) => d.minutes));
  const recent = [...log].reverse().slice(0, 6);
  const dayName = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
  return h(
    'section',
    { class: 'practice-log' },
    h('h2', {}, 'Your practice'),
    h('dl', { class: 'score' },
      h('div', {}, h('dt', {}, 'Streak'), h('dd', {}, `${streak(log, today)} ${streak(log, today) === 1 ? 'day' : 'days'}`)),
      h('div', {}, h('dt', {}, 'Last 7 days'), h('dd', {}, `${weekMinutes(log, today)} min`)),
      h('div', {}, h('dt', {}, 'Sessions'), h('dd', {}, String(log.length)))),
    h('ol', { class: 'day-bars', 'aria-label': 'Minutes practiced each day, last two weeks' },
      ...days.map((d) => h('li', { title: `${d.date}: ${d.minutes} min` },
        h('span', { class: 'bar', style: `height:${Math.round((d.minutes / max) * 100)}%` }),
        h('small', {}, dayName(d.date).slice(0, 2))))),
    recent.length
      ? h('ul', { class: 'recent' }, ...recent.map((e) => h('li', {}, h('b', {}, e.planName), ` ${e.minutes} min, ${e.steps} of ${e.total} steps`, h('span', { class: 'meta' }, ` ${e.date}`))))
      : h('p', { class: 'hint' }, 'Finished sessions appear here. The log is kept in this browser only.'),
    log.length
      ? confirmClear
        ? h('p', {}, 'Delete the whole log? ',
          h('button', { type: 'button', class: 'chip', onclick: () => { session.clearLog(); confirmClear = false; } }, 'Delete log'), ' ',
          h('button', { type: 'button', class: 'chip', onclick: () => { confirmClear = false; rerender(); } }, 'Keep it'))
        : h('button', { type: 'button', class: 'chip', onclick: () => { confirmClear = true; rerender(); } }, 'Clear log')
      : null,
  );
}

function tips(): HTMLElement {
  return h('section', { class: 'explainer' },
    h('h2', {}, 'Practice tips'),
    ...PRACTICE_TIPS.map((t) => h('details', {}, h('summary', {}, t.title), h('div', { class: 'prose' }, h('p', {}, t.text)))));
}

let container: HTMLElement | null = null;
const rerender = () => {
  if (container && getState().view === 'sessions') renderSessions(container);
};
let lastKey = '';
session.onSessionChange(() => {
  // While a session runs it changes every second; only redraw when the step changes.
  // The clock itself lives in the session bar.
  const s = session.current();
  const key = s ? `${s.planId}:${s.index}` : '';
  if (!s || key !== lastKey) rerender();
  lastKey = key;
});

export function renderSessions(root: HTMLElement, _st: State = getState()): void {
  container = root;
  const running = session.current();
  if (running && planById(running.planId)) selected = running.planId;
  const finished = session.takeLastFinished();
  const plan = planById(selected) ?? PLANS[0];
  root.replaceChildren(
    finished
      ? h('div', { class: 'done-banner', role: 'status' }, h('b', {}, 'Session logged. '), `${finished.planName}: ${finished.minutes} ${finished.minutes === 1 ? 'minute' : 'minutes'}, ${finished.steps} of ${finished.total} steps.`)
      : h('span', { hidden: true }),
    h('div', { class: 'sessions-layout' },
      h('div', {},
        h('h2', {}, 'Practice plans'),
        h('p', { class: 'prose' }, 'Pick a plan and start it. A bar under the header keeps time and takes you to each exercise; a soft chime marks the end of each step. Adjust the minutes before you start to fit your day.'),
        h('ol', { class: 'plan-cards' }, ...PLANS.map(planCard)),
        planDetail(plan)),
      h('div', {}, logView(), tips())),
  );
}
