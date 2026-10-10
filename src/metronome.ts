/**
 * Metronome engine. Uses the classic look-ahead pattern: a timer wakes every
 * 25 ms and schedules any clicks due in the next 120 ms on the audio clock,
 * so timing stays sample-accurate even when the page is busy. Visual updates
 * are fired from requestAnimationFrame when each scheduled tick actually sounds.
 */
import { audioContext, clickAt, playNoteAt } from './audio';
import { type RampSettings, clampBpm, rampTempo, tickLevel, tickSeconds, bounce } from './theory/tempo';

export interface MetronomeSettings {
  bpm: number;
  beats: number;
  /** Ticks per beat: 1 quarters, 2 eighths, 3 triplets, 4 sixteenths. */
  subdivision: number;
  accent: boolean;
  rampOn: boolean;
  ramp: RampSettings;
  /** Play the highlighted fretboard position along with the click. */
  guide: boolean;
}

export interface GuideNote {
  midi: number;
  /** "string:fret" of the note on the neck, for highlighting. */
  pos: string;
}

export interface TickEvent {
  tickInBar: number;
  beat: number;
  bar: number;
  bpm: number;
  level: 0 | 1 | 2;
  /** Bars since the speed trainer started. */
  rampBar: number;
  guidePos?: string;
}

const STORE = 'fretwise:metronome';
const defaults: MetronomeSettings = {
  bpm: 90,
  beats: 4,
  subdivision: 2,
  accent: true,
  rampOn: false,
  ramp: { from: 80, to: 140, step: 5, every: 4 },
  guide: true,
};

function load(): MetronomeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<MetronomeSettings>;
    return { ...defaults, ...saved, ramp: { ...defaults.ramp, ...(saved.ramp ?? {}) } };
  } catch {
    return { ...defaults, ramp: { ...defaults.ramp } };
  }
}

export const settings: MetronomeSettings = load();

type Listener = () => void;
type TickListener = (e: TickEvent) => void;
const changeListeners: Listener[] = [];
const tickListeners: TickListener[] = [];

export const onChange = (l: Listener): void => void changeListeners.push(l);
export const onTick = (l: TickListener): void => void tickListeners.push(l);
const emitChange = () => changeListeners.forEach((l) => l());

export function update(patch: Partial<MetronomeSettings>): void {
  Object.assign(settings, patch);
  settings.bpm = clampBpm(settings.bpm);
  settings.ramp.from = clampBpm(settings.ramp.from);
  settings.ramp.to = clampBpm(settings.ramp.to);
  settings.ramp.step = Math.max(1, Math.min(50, Math.round(settings.ramp.step)));
  settings.ramp.every = Math.max(1, Math.min(32, Math.round(settings.ramp.every)));
  try {
    localStorage.setItem(STORE, JSON.stringify(settings));
  } catch {
    /* settings just won't persist */
  }
  // A manual tempo change while ramping takes over from the ramp.
  if (running && patch.bpm !== undefined && !patch.rampOn) {
    settings.rampOn = false;
    currentBpm = settings.bpm;
  }
  if (running && patch.rampOn) startRampFromHere();
  emitChange();
}

/* ---------- Guide notes (set by the fretboard view) ---------- */

let guideRun: GuideNote[] | null = null;
let guideLabel = '';
let guideIndex = 0;

/** Ascending notes of the highlighted position; the engine plays them up and back down. */
export function setGuide(notes: GuideNote[] | null, label = ''): void {
  const run = notes && notes.length ? bounce(notes) : null;
  const same = JSON.stringify(run) === JSON.stringify(guideRun);
  guideRun = run;
  guideLabel = label;
  if (!same) guideIndex = 0;
  emitChange();
}

export const guideInfo = (): { available: boolean; label: string } => ({ available: !!guideRun, label: guideLabel });

/* ---------- Transport ---------- */

let running = false;
let timer: number | undefined;
let raf = 0;
let nextTime = 0;
let tickInBar = 0;
let bar = 0;
let rampBarOffset = 0;
let currentBpm = settings.bpm;
const queue: { time: number; event: TickEvent }[] = [];

export const isRunning = (): boolean => running;
export const currentTempo = (): number => currentBpm;

function startRampFromHere(): void {
  rampBarOffset = bar;
  currentBpm = rampTempo(settings.ramp, 0);
}

function scheduler(): void {
  const ac = audioContext();
  if (!ac) return;
  while (nextTime < ac.currentTime + 0.12) {
    const level = tickLevel(tickInBar, settings.subdivision, settings.accent);
    clickAt(nextTime, level);
    let guidePos: string | undefined;
    if (settings.guide && guideRun) {
      const note = guideRun[guideIndex % guideRun.length];
      guideIndex++;
      playNoteAt(note.midi, nextTime, 0.7);
      guidePos = note.pos;
    }
    queue.push({
      time: nextTime,
      event: { tickInBar, beat: Math.floor(tickInBar / settings.subdivision), bar, rampBar: bar - rampBarOffset, bpm: currentBpm, level, guidePos },
    });

    nextTime += tickSeconds(currentBpm, settings.subdivision);
    tickInBar++;
    if (tickInBar >= settings.beats * settings.subdivision) {
      tickInBar = 0;
      bar++;
      if (settings.rampOn) currentBpm = rampTempo(settings.ramp, bar - rampBarOffset);
    }
  }
}

function frame(): void {
  const ac = audioContext();
  if (ac) {
    while (queue.length && queue[0].time <= ac.currentTime) {
      const { event } = queue.shift()!;
      tickListeners.forEach((l) => l(event));
    }
  }
  if (running) raf = requestAnimationFrame(frame);
}

export function start(): void {
  const ac = audioContext();
  if (!ac || running) return;
  running = true;
  tickInBar = 0;
  bar = 0;
  rampBarOffset = 0;
  guideIndex = 0;
  currentBpm = settings.rampOn ? rampTempo(settings.ramp, 0) : settings.bpm;
  nextTime = ac.currentTime + 0.08;
  queue.length = 0;
  scheduler();
  timer = window.setInterval(scheduler, 25);
  raf = requestAnimationFrame(frame);
  emitChange();
}

export function stop(): void {
  if (!running) return;
  running = false;
  window.clearInterval(timer);
  cancelAnimationFrame(raf);
  queue.length = 0;
  emitChange();
}

export const toggle = (): void => (running ? stop() : start());
