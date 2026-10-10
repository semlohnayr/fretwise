/**
 * Plucked-string synth built on the Karplus–Strong algorithm: a burst of
 * noise fed through a short, slightly lossy delay line rings like a string.
 * Buffers are rendered once per pitch and cached, so playback is cheap.
 * No samples, no dependencies.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const cache = new Map<number, AudioBuffer>();
const active = new Set<AudioBufferSourceNode>();

const STORAGE_KEY = 'fretwise:muted';
let muted = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
})();

type MuteListener = (muted: boolean) => void;
const muteListeners: MuteListener[] = [];

export const isMuted = (): boolean => muted;

export function setMuted(m: boolean): void {
  muted = m;
  if (m) stopAll();
  try {
    localStorage.setItem(STORAGE_KEY, m ? '1' : '0');
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
  muteListeners.forEach((l) => l(m));
}

export function onMuteChange(l: MuteListener): void {
  muteListeners.push(l);
}

export const audioSupported = (): boolean =>
  typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);

function context(): AudioContext | null {
  if (!audioSupported()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    // A gentle low-pass and compressor keep stacked chords from clipping or sounding harsh.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(tone).connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Render a plucked string at `midi` pitch. Pure, so its tuning can be unit-tested. */
export function renderString(sr: number, midi: number, seconds: number, rand: () => number = Math.random): Float32Array {
  const len = Math.floor(sr * seconds);
  const out = new Float32Array(len);
  // Loop delay = buffer length + half a sample (the averaging filter) + an all-pass
  // fractional delay, which keeps high notes in tune.
  const period = sr / midiToHz(midi);
  const n = Math.max(2, Math.floor(period - 0.6));
  const d = period - 0.5 - n;
  const C = (1 - d) / (1 + d);
  // Lower notes sustain longer, like real strings.
  const decay = 0.9965 + Math.min(0.0025, Math.max(0, (60 - midi) * 0.00006));
  const line = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    // Low-passed noise: a softer, pick-like attack.
    prev = prev * 0.45 + (rand() * 2 - 1) * 0.55;
    line[i] = prev;
  }
  let idx = 0;
  let lastOut = 0;
  let apX = 0;
  let apY = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    out[i] = cur;
    const filtered = decay * 0.5 * (cur + lastOut);
    const ap = C * filtered + apX - C * apY;
    apX = filtered;
    apY = ap;
    line[idx] = ap;
    lastOut = cur;
    idx = idx + 1 === n ? 0 : idx + 1;
  }
  // Short fade-out to avoid a click at the end.
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade && i < len; i++) out[len - 1 - i] *= i / fade;
  return out;
}

function stringBuffer(ac: AudioContext, midi: number): AudioBuffer {
  const hit = cache.get(midi);
  if (hit) return hit;
  const data = renderString(ac.sampleRate, midi, midi < 52 ? 3.2 : 2.4);
  const buf = ac.createBuffer(1, data.length, ac.sampleRate);
  buf.getChannelData(0).set(data);
  cache.set(midi, buf);
  return buf;
}

/** Play one note `delay` seconds from now. */
export function playNote(midi: number, delay = 0, gain = 0.8): void {
  if (muted) return;
  const ac = context();
  if (!ac || !master) return;
  const src = ac.createBufferSource();
  src.buffer = stringBuffer(ac, midi);
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(ac.currentTime + 0.02 + delay);
  active.add(src);
  src.onended = () => active.delete(src);
}

/** Strum notes low to high. */
export function playChord(midis: number[], delay = 0, strum = 0.035): void {
  const sorted = [...midis].sort((a, b) => a - b);
  const gain = Math.min(0.8, 2.2 / Math.max(1, sorted.length));
  sorted.forEach((m, i) => playNote(m, delay + i * strum, gain));
}

/** Notes one after another. */
export function playSequence(midis: number[], step = 0.3, delay = 0): void {
  midis.forEach((m, i) => playNote(m, delay + i * step));
}

/** Strum a list of chords, one per beat. */
export function playProgression(chords: number[][], beat = 0.95): void {
  chords.forEach((c, i) => playChord(c, i * beat));
}

/** A scale up and back down, over a low root drone that re-sounds every bar. */
export function playScaleWithDrone(scale: number[], step = 0.3): void {
  const run = [...scale, ...[...scale].reverse().slice(1)];
  const total = run.length * step;
  const root = scale[0] - 12;
  for (let t = 0; t < total; t += step * 4) playNote(root, t, 0.55);
  playSequence(run, step);
}

export function stopAll(): void {
  for (const src of active) {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
  }
  active.clear();
}

/* ---------- Pitch helpers for things that have no fretboard position ---------- */

/** Root in the octave starting at C3 (MIDI 48). */
export const rootMidi = (pitchClass: number, octaveStart = 48): number => octaveStart + (((pitchClass % 12) + 12) % 12);

/** Close-position chord from a root and interval sizes in semitones. */
export const chordMidis = (pitchClass: number, semitones: number[]): number[] => semitones.map((s) => rootMidi(pitchClass) + s);

/** One octave of a scale, root to root. */
export const scaleMidis = (pitchClass: number, semitones: number[]): number[] => {
  const r = rootMidi(pitchClass);
  return [...semitones.map((s) => r + s), r + 12];
};
