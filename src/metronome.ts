/**
 * Metronome and playback engine. Uses the classic look-ahead pattern: a timer
 * wakes every 25 ms and schedules everything due in the next 120 ms on the
 * audio clock, so timing stays sample-accurate even when the page is busy.
 *
 * The click is always available; a page can also supply a Track (a scale
 * position to play along with, a tune, a backing pattern) which the engine
 * asks to schedule itself one tick at a time, at whatever tempo is current.
 * Visual updates run from requestAnimationFrame when each event actually sounds.
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
  /** Play the current page's exercise (track) along with the click. */
  guide: boolean;
  /** Sound the click at all (turn off to hear just the track). */
  click: boolean;
}

export interface TickEvent {
  tickInBar: number;
  beat: number;
  bar: number;
  bpm: number;
  level: 0 | 1 | 2;
  /** Bars since the speed trainer started. */
  rampBar: number;
  /** Beats into the track (negative during a count-in). */
  trackBeat: number;
}

/** Something that plays in time with the metronome. Beats are quarter notes from the track's start. */
export interface Track {
  label: string;
  /** Beats per bar while this track plays (overrides the metronome setting). */
  beatsPerBar?: number;
  /** Bars of click before the track starts. */
  countIn?: number;
  /** Schedule audio (and visuals via `at`) for track beats in [from, to). */
  schedule(from: number, to: number, time: (beat: number) => number): void;
  /** Stop playback after this many track beats (for a single graded pass). */
  stopAfter?: number;
  /** Use an unpitched click so a microphone does not mistake it for a note. */
  quietClick?: boolean;
  /** Schedule even when "Play along" is switched off (grading, calibration). */
  required?: boolean;
  onStart?(startTime: number, beatSeconds: number): void;
  onStop?(): void;
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
  click: true,
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

/* ---------- Tracks ---------- */

let track: Track | null = null;

/** Set (or clear) what plays along with the click. Changing it while playing takes effect at once. */
export function setTrack(t: Track | null): void {
  if (t === track) return;
  // A track with its own count-in or end needs a clean restart; stop() tells the old track.
  if (running && t && (t.countIn || t.stopAfter)) stop();
  else if (running) track?.onStop?.();
  track = t;
  if (running) trackStartBeat = engineBeat;
  emitChange();
}

export const currentTrack = (): Track | null => track;

/** A scale position played one note per click, up and back down (the fretboard's play-along). */
export function guideTrack(notes: { midi: number; pos: string }[], label: string, mark: (pos: string) => void): Track {
  const run = bounce(notes);
  return {
    label,
    schedule(from, to, time) {
      const sub = settings.subdivision;
      for (let k = Math.ceil(from * sub - 1e-9); k / sub < to - 1e-9; k++) {
        if (k < 0) continue;
        const note = run[k % run.length];
        const t = time(k / sub);
        playNoteAt(note.midi, t, 0.7);
        at(t, () => mark(note.pos));
      }
    },
  };
}

/* ---------- Visual callbacks ---------- */

const visuals: { time: number; fn: () => void }[] = [];

/** Run `fn` when the audio clock reaches `time` (for highlighting what is sounding). */
export function at(time: number, fn: () => void): void {
  visuals.push({ time, fn });
}

/* ---------- Transport ---------- */

let running = false;
let timer: number | undefined;
let raf = 0;
let nextTime = 0;
let tickInBar = 0;
let bar = 0;
let rampBarOffset = 0;
let currentBpm = settings.bpm;
/** Beats since the engine started (counts quarter-note beats, including count-in). */
let engineBeat = 0;
let trackStartBeat = 0;
let stopAt = Infinity;
const queue: { time: number; event: TickEvent }[] = [];

export const isRunning = (): boolean => running;
export const currentTempo = (): number => currentBpm;
const beatsPerBar = () => track?.beatsPerBar ?? settings.beats;

function startRampFromHere(): void {
  rampBarOffset = bar;
  currentBpm = rampTempo(settings.ramp, 0);
}

function scheduler(): void {
  const ac = audioContext();
  if (!ac) return;
  while (nextTime < ac.currentTime + 0.12) {
    const sub = settings.subdivision;
    const tickBeats = 1 / sub;
    const secPerBeat = 60 / currentBpm;
    const level = tickLevel(tickInBar, sub, settings.accent);
    const trackBeat = engineBeat - trackStartBeat;
    if (trackBeat >= stopAt - 1e-9) {
      const t = nextTime;
      at(t, () => stop());
      nextTime = Infinity;
      break;
    }
    if (settings.click || trackBeat < 0 || track?.quietClick) clickAt(nextTime, level, track?.quietClick);
    if (track && (settings.guide || track.required)) {
      const tickTime = nextTime;
      track.schedule(trackBeat, trackBeat + tickBeats, (b) => tickTime + (b - trackBeat) * secPerBeat);
    }
    queue.push({
      time: nextTime,
      event: { tickInBar, beat: Math.floor(tickInBar / sub), bar, rampBar: bar - rampBarOffset, bpm: currentBpm, level, trackBeat },
    });

    nextTime += tickSeconds(currentBpm, sub);
    engineBeat += tickBeats;
    tickInBar++;
    if (tickInBar >= beatsPerBar() * sub) {
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
    visuals.sort((a, b) => a.time - b.time);
    while (visuals.length && visuals[0].time <= ac.currentTime) visuals.shift()!.fn();
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
  engineBeat = 0;
  const countIn = track?.countIn ?? 0;
  trackStartBeat = countIn * beatsPerBar();
  stopAt = track?.stopAfter ?? Infinity;
  currentBpm = settings.rampOn ? rampTempo(settings.ramp, 0) : settings.bpm;
  nextTime = ac.currentTime + 0.08;
  queue.length = 0;
  visuals.length = 0;
  track?.onStart?.(nextTime + trackStartBeat * (60 / currentBpm), 60 / currentBpm);
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
  visuals.length = 0;
  track?.onStop?.();
  emitChange();
}

export const toggle = (): void => (running ? stop() : start());
