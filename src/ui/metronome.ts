import * as metro from '../metronome';
import { rampLength, tapTempo, MIN_BPM, MAX_BPM } from '../theory/tempo';
import { isMuted } from '../audio';
import { h, segmented } from './dom';
import { markNow } from './highlight';

let dock: HTMLElement | null = null;
let open = false;
const taps: number[] = [];
// On small screens the settings start folded away so the neck stays visible.
let showSettings = typeof matchMedia === 'undefined' || !matchMedia('(max-width: 600px)').matches;

const FEELS = [
  { value: '1', label: 'Quarters' },
  { value: '2', label: 'Eighths' },
  { value: '3', label: 'Triplets' },
  { value: '4', label: '16ths' },
];

function num(label: string, value: number, min: number, max: number, onSet: (v: number) => void, suffix?: string): HTMLElement {
  return h(
    'label',
    { class: 'mini-field' },
    h('span', {}, label),
    h('input', {
      type: 'number',
      inputmode: 'numeric',
      min,
      max,
      value,
      onchange: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        if (Number.isFinite(v)) onSet(v);
      },
    }),
    suffix ? h('span', { class: 'suffix' }, suffix) : null,
  );
}

function build(): HTMLElement {
  const st = metro.settings;
  const running = metro.isRunning();
  const tempo = running ? metro.currentTempo() : st.rampOn ? st.ramp.from : st.bpm;
  const track = metro.currentTrack();
  const setBpm = (v: number) => metro.update({ bpm: v });

  const lights = h(
    'div',
    { class: 'beat-lights', 'aria-hidden': 'true' },
    ...Array.from({ length: st.beats }, (_, i) => h('i', { class: i === 0 && st.accent ? 'accent' : '' })),
  );

  return h(
    'section',
    { class: 'metro', 'aria-label': 'Metronome' },
    h(
      'div',
      { class: 'metro-main' },
      h('button', { type: 'button', class: `metro-go ${running ? 'on' : ''}`, onclick: () => metro.toggle(), 'aria-pressed': String(running) }, running ? 'Stop' : 'Start'),
      h(
        'div',
        { class: 'tempo' },
        h('button', { type: 'button', class: 'step', 'aria-label': 'Slower', onclick: () => setBpm(metro.settings.bpm - 1), disabled: st.rampOn }, '−'),
        h('output', { class: 'bpm', 'aria-live': 'off' }, h('b', { id: 'metro-bpm' }, String(tempo)), h('small', {}, 'BPM')),
        h('button', { type: 'button', class: 'step', 'aria-label': 'Faster', onclick: () => setBpm(metro.settings.bpm + 1), disabled: st.rampOn }, '+'),
      ),
      h('input', {
        type: 'range',
        class: 'tempo-slider',
        min: MIN_BPM,
        max: MAX_BPM,
        value: st.bpm,
        disabled: st.rampOn,
        'aria-label': 'Tempo',
        oninput: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          const out = document.querySelector('#metro-bpm');
          if (out) out.textContent = String(v);
        },
        onchange: (e: Event) => setBpm(Number((e.target as HTMLInputElement).value)),
      }),
      h('button', {
        type: 'button',
        class: 'chip',
        disabled: st.rampOn,
        onclick: () => {
          const now = performance.now();
          if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
          taps.push(now);
          const bpm = tapTempo(taps);
          if (bpm) setBpm(bpm);
        },
      }, 'Tap tempo'),
      lights,
      h('button', { type: 'button', class: 'metro-close', 'aria-label': 'Close metronome', onclick: () => setOpen(false) }, '×'),
    ),
    h(
      'details',
      { class: 'metro-more', open: showSettings, ontoggle: (e: Event) => { showSettings = (e.target as HTMLDetailsElement).open; } },
      h('summary', {}, 'Beats, clicks, speed trainer and play-along'),
    h(
      'div',
      { class: 'metro-row' },
      segmented('Beats per bar', String(st.beats), ['2', '3', '4', '5', '6', '7'].map((b) => ({ value: b, label: b })), (v) => metro.update({ beats: Number(v) })),
      segmented('Clicks', String(st.subdivision), FEELS, (v) => metro.update({ subdivision: Number(v) })),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: st.accent, onchange: (e: Event) => metro.update({ accent: (e.target as HTMLInputElement).checked }) }), 'Accent beat 1'),
    ),
    h(
      'div',
      { class: 'metro-row ramp' },
      h('label', { class: 'toggle strong' },
        h('input', {
          type: 'checkbox',
          checked: st.rampOn,
          onchange: (e: Event) => {
            const on = (e.target as HTMLInputElement).checked;
            // Turning the trainer off keeps whatever tempo it had reached.
            metro.update(on ? { rampOn: true } : { rampOn: false, bpm: metro.isRunning() ? metro.currentTempo() : metro.settings.bpm });
          },
        }),
        'Speed trainer'),
      num('From', st.ramp.from, MIN_BPM, MAX_BPM, (v) => metro.update({ ramp: { ...metro.settings.ramp, from: v } })),
      num('to', st.ramp.to, MIN_BPM, MAX_BPM, (v) => metro.update({ ramp: { ...metro.settings.ramp, to: v } }), 'BPM'),
      num('step', st.ramp.step, 1, 50, (v) => metro.update({ ramp: { ...metro.settings.ramp, step: v } }), 'BPM'),
      num('every', st.ramp.every, 1, 32, (v) => metro.update({ ramp: { ...metro.settings.ramp, every: v } }), st.ramp.every === 1 ? 'bar' : 'bars'),
      h('p', { class: 'ramp-status', id: 'metro-ramp' }, rampSummary()),
    ),
    h(
      'div',
      { class: 'metro-row' },
      h('label', { class: 'toggle' },
        h('input', { type: 'checkbox', checked: st.guide, onchange: (e: Event) => metro.update({ guide: (e.target as HTMLInputElement).checked }) }),
        'Play along'),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: st.click, onchange: (e: Event) => metro.update({ click: (e.target as HTMLInputElement).checked }) }), 'Click'),
      h('p', { class: 'guide-status' },
        track
          ? `Now: ${track.label}.`
          : 'Pick a 3-per-string position or a single CAGED shape on the Fretboard page, or a tune, lick or melody on the Melody page, to play along with the click.'),
    ),
    ),
    isMuted() ? h('p', { class: 'error' }, 'Sound is off, so only the beat lights will move.') : null,
  );
}

function rampSummary(bpm?: number, bar?: number): string {
  const r = metro.settings.ramp;
  if (!metro.settings.rampOn) return `Starts at ${r.from} and climbs ${r.step} BPM every ${r.every} ${r.every === 1 ? 'bar' : 'bars'} until ${r.to}.`;
  const total = rampLength(r);
  if (bpm === undefined || bar === undefined) return `Reaches ${r.to} BPM after ${total} bars, then holds.`;
  if (bpm === r.to) return `Holding at the target, ${r.to} BPM.`;
  return `Bar ${bar + 1} of ${total}, heading for ${r.to} BPM.`;
}

function onTick(e: metro.TickEvent): void {
  if (!dock) return;
  const lights = dock.querySelectorAll('.beat-lights i');
  lights.forEach((el, i) => el.classList.toggle('lit', i === e.beat && e.level > 0));
  const bpm = dock.querySelector('#metro-bpm');
  if (bpm) bpm.textContent = String(e.bpm);
  if (metro.settings.rampOn && e.tickInBar === 0) {
    const ramp = dock.querySelector('#metro-ramp');
    if (ramp) ramp.textContent = rampSummary(e.bpm, e.rampBar);
  }
}

let rendering = false;
let pending = false;

function render(): void {
  // Replacing the dock blurs a focused number field, which fires its change
  // handler, which asks for another render. Defer that one instead of nesting.
  if (rendering) {
    pending = true;
    return;
  }
  rendering = true;
  try {
    renderNow();
  } finally {
    rendering = false;
  }
  if (pending) {
    pending = false;
    queueMicrotask(render);
  }
}

function renderNow(): void {
  if (!dock) return;
  dock.hidden = !open;
  document.body.classList.toggle('metro-open', open);
  const toggleBtn = document.querySelector('#metro-toggle');
  toggleBtn?.setAttribute('aria-expanded', String(open));
  toggleBtn?.classList.toggle('running', metro.isRunning());
  if (open) dock.replaceChildren(build());
  if (!metro.isRunning()) markNow(null);
}

export function setOpen(v: boolean): void {
  open = v;
  if (!v) metro.stop();
  render();
  if (v) dock?.querySelector<HTMLButtonElement>('.metro-go')?.focus();
}

export function initMetronome(): void {
  dock = document.querySelector('#metronome');
  document.querySelector('#metro-toggle')?.addEventListener('click', () => setOpen(!open));
  metro.onChange(render);
  metro.onTick(onTick);
  // Space starts and stops the metronome while it is open, unless you are typing or on a control.
  document.addEventListener('keydown', (e) => {
    if (!open || e.key !== ' ' || e.repeat) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, button, a, [role=button]')) return;
    e.preventDefault();
    metro.toggle();
  });
  render();
}

/** Open the dock with the speed-trainer settings showing. */
export function openSpeedTrainer(): void {
  showSettings = true;
  setOpen(true);
}
