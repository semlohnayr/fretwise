/**
 * Microphone input: pitch frames from the player's guitar, on the same audio
 * clock as playback, so performances can be graded against the click.
 */
import { audioContext } from './audio';
import { type Frame, detectPitch } from './theory/pitch';

let stream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
let timer: number | undefined;
let buf: Float32Array<ArrayBuffer> | null = null;
let frames: Frame[] = [];
let recording = false;
let processor: ScriptProcessorNode | null = null;
let chunks: Float32Array[] = [];
let recordT0: number | null = null;
const listeners: ((f: Frame & { cents?: number }) => void)[] = [];

const LATENCY_KEY = 'fretwise:mic-latency-ms';

export const micSupported = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Extra delay between a note sounding and the microphone hearing it, from calibration. */
export function latencyMs(): number {
  try {
    return Number(localStorage.getItem(LATENCY_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

export function setLatencyMs(ms: number): void {
  try {
    localStorage.setItem(LATENCY_KEY, String(Math.round(ms)));
  } catch {
    /* calibration just won't persist */
  }
}

export const isOpen = (): boolean => !!stream;

/** Ask for the microphone. Rejects with a readable message if it is blocked or missing. */
export async function open(): Promise<void> {
  if (stream) return;
  const ac = audioContext();
  if (!ac) throw new Error('This browser has no Web Audio support.');
  if (!micSupported()) throw new Error('This browser does not allow microphone access here. Use a recent browser over https.');
  try {
    // Echo cancellation and noise suppression would smear the guitar's attack and pitch.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    const name = (e as DOMException).name;
    throw new Error(
      name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.'
        : name === 'NotFoundError'
          ? 'No microphone was found.'
          : 'The microphone could not be opened.',
    );
  }
  const src = ac.createMediaStreamSource(stream);
  analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  buf = new Float32Array(analyser.fftSize);
  timer = window.setInterval(poll, 12);
  // Raw samples for analysing a whole take afterwards. ScriptProcessor is deprecated but is
  // the one way to tap raw input that works everywhere without a separate worklet file.
  processor = ac.createScriptProcessor(2048, 1, 1);
  processor.onaudioprocess = (e) => {
    if (!recording) return;
    const data = e.inputBuffer.getChannelData(0);
    if (recordT0 === null) recordT0 = ac.currentTime - data.length / ac.sampleRate - latencyMs() / 1000;
    chunks.push(new Float32Array(data));
  };
  const sink = ac.createGain();
  sink.gain.value = 0;
  src.connect(processor);
  processor.connect(sink).connect(ac.destination);
}

export function close(): void {
  window.clearInterval(timer);
  processor?.disconnect();
  processor = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  analyser = null;
  recording = false;
}

function poll(): void {
  const ac = audioContext();
  if (!ac || !analyser || !buf) return;
  analyser.getFloatTimeDomainData(buf);
  const r = detectPitch(buf, ac.sampleRate);
  // The analysis window ends now; its centre is half a window ago. Subtract measured latency too.
  const time = ac.currentTime - buf.length / ac.sampleRate / 2 - latencyMs() / 1000;
  let rms = r?.rms ?? 0;
  if (!r) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    rms = Math.sqrt(s / buf.length);
  }
  const midi = r && r.clarity > 0.8 && r.midi >= 36 && r.midi <= 90 ? r.midi : null;
  const frame: Frame & { cents?: number } = { time, rms, midi, cents: r?.cents };
  if (recording) frames.push(frame);
  listeners.forEach((l) => l(frame));
}

export function startRecording(): void {
  frames = [];
  chunks = [];
  recordT0 = null;
  recording = true;
}

export interface Take {
  samples: Float32Array;
  sampleRate: number;
  /** Audio-clock time of the first sample, corrected for measured latency. */
  t0: number;
  frames: Frame[];
}

export function stopRecording(): Take {
  recording = false;
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const samples = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    samples.set(c, o);
    o += c.length;
  }
  chunks = [];
  return { samples, sampleRate: audioContext()?.sampleRate ?? 48000, t0: recordT0 ?? 0, frames };
}

/** Live readout (for a tuner-style "I can hear you" display). Returns an unsubscribe function. */
export function onFrame(l: (f: Frame & { cents?: number }) => void): () => void {
  listeners.push(l);
  return () => {
    const i = listeners.indexOf(l);
    if (i >= 0) listeners.splice(i, 1);
  };
}
