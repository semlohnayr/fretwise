/**
 * Pitch detection and performance grading. Pure functions over sample
 * buffers and frame lists, so they can be tested without a microphone.
 */

export interface PitchResult {
  freq: number;
  midi: number;
  /** Distance from the nearest semitone, -50..50. */
  cents: number;
  /** 0..1; how periodic the frame is (1 - YIN dip). */
  clarity: number;
  rms: number;
}

/**
 * YIN pitch detector (de Cheveigné & Kawahara, 2002): cumulative mean
 * normalised difference, first dip under the threshold, parabolic refinement.
 * Tuned for the guitar range (about 70 Hz to 1.4 kHz).
 */
export function detectPitch(buf: Float32Array, sr: number, threshold = 0.15, minHz = 70, maxHz = 1400): PitchResult | null {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.008) return null;

  const maxLag = Math.min(Math.floor(sr / minHz), Math.floor(buf.length / 2));
  const minLag = Math.max(2, Math.floor(sr / maxHz));
  const W = buf.length - maxLag;
  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const x = buf[i] - buf[i + lag];
      s += x * x;
    }
    d[lag] = s;
  }
  // Cumulative mean normalised difference.
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag];
    cmnd[lag] = running ? (d[lag] * lag) / running : 1;
  }
  let tau = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cmnd[lag] < threshold) {
      while (lag + 1 <= maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
      tau = lag;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation around the dip.
  const a = cmnd[tau - 1] ?? cmnd[tau];
  const b = cmnd[tau];
  const c = cmnd[tau + 1] ?? cmnd[tau];
  const denom = a - 2 * b + c;
  const refined = denom ? tau + (0.5 * (a - c)) / denom : tau;
  const freq = sr / refined;
  const exact = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(exact);
  return { freq, midi, cents: Math.round((exact - midi) * 100), clarity: 1 - b, rms };
}

/* ---------- Note onsets from a stream of frames ---------- */

export interface Frame {
  /** Seconds (audio clock). */
  time: number;
  rms: number;
  midi: number | null;
}

export interface DetectedNote {
  time: number;
  midi: number;
}

/**
 * Turn analysis frames into note onsets. A new note starts when the level
 * jumps (a pick attack) or when a steady new pitch appears (a hammer-on,
 * pull-off or slide). A pitch must hold for two frames to count.
 */
export function segmentNotes(frames: Frame[], opts: { attackRatio?: number; floor?: number } = {}): DetectedNote[] {
  const attack = opts.attackRatio ?? 1.6;
  const floor = opts.floor ?? 0.01;
  const out: DetectedNote[] = [];
  let prevRms = 0;
  let current: number | null = null;
  let pendingAttack: number | null = null;
  let lastOnset = -Infinity;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const next = frames[i + 1];
    const stable = f.midi !== null && next !== undefined && next.midi === f.midi;
    // A pick attack: the level jumps compared with the previous frame.
    const isAttack = f.rms > floor && f.rms > prevRms * attack && f.time - lastOnset > 0.04;
    prevRms = f.rms;
    if (isAttack) pendingAttack = f.time;
    if (f.rms < floor * 0.6) {
      current = null;
      continue;
    }
    if (stable && (pendingAttack !== null || f.midi !== current)) {
      out.push({ time: pendingAttack ?? f.time, midi: f.midi! });
      lastOnset = pendingAttack ?? f.time;
      current = f.midi;
      pendingAttack = null;
    }
    // An attack that never settles on a pitch is forgotten after a few frames.
    if (pendingAttack !== null && f.time - pendingAttack > 0.12) pendingAttack = null;
  }
  return out;
}

/* ---------- Grading ---------- */

export type Verdict = 'hit' | 'octave' | 'wrong' | 'missed';

export interface GradedNote {
  expected: { time: number; midi: number };
  verdict: Verdict;
  /** Played minus expected, in milliseconds (hits and octave errors only). */
  offsetMs?: number;
  played?: number;
}

export interface GradeSummary {
  notes: GradedNote[];
  hits: number;
  /** Fraction of notes played on the right pitch, 0..1. */
  accuracy: number;
  /** Mean absolute timing error of hits, ms. */
  meanAbsMs: number;
  /** Mean signed timing error: negative = rushing, positive = dragging. */
  meanMs: number;
}

/**
 * Match each expected note to the nearest unused played note inside a timing
 * window, then judge its pitch. `window` is in seconds either side.
 */
export function grade(expected: { time: number; midi: number }[], played: DetectedNote[], window: number): GradeSummary {
  const used = new Set<number>();
  const notes: GradedNote[] = expected.map((e) => {
    let best = -1;
    let bestScore = Infinity;
    played.forEach((p, k) => {
      if (used.has(k)) return;
      const dt = Math.abs(p.time - e.time);
      if (dt > window) return;
      // Prefer the right pitch, then the closest in time.
      const pitchPenalty = p.midi === e.midi ? 0 : (p.midi - e.midi) % 12 === 0 ? window * 0.5 : window;
      const score = dt + pitchPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    });
    if (best < 0) return { expected: e, verdict: 'missed' as const };
    used.add(best);
    const p = played[best];
    const offsetMs = Math.round((p.time - e.time) * 1000);
    if (p.midi === e.midi) return { expected: e, verdict: 'hit' as const, offsetMs, played: p.midi };
    if ((p.midi - e.midi) % 12 === 0) return { expected: e, verdict: 'octave' as const, offsetMs, played: p.midi };
    return { expected: e, verdict: 'wrong' as const, played: p.midi };
  });
  const hits = notes.filter((n) => n.verdict === 'hit');
  const offs = hits.map((n) => n.offsetMs!);
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  return {
    notes,
    hits: hits.length,
    accuracy: expected.length ? hits.length / expected.length : 0,
    meanAbsMs: mean(offs.map(Math.abs)),
    meanMs: mean(offs),
  };
}

/** Median of a list (used for latency calibration). */
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ---------- Offline analysis of a whole recording ---------- */

/** In-place radix-2 FFT. `re` and `im` must have a power-of-two length. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const FFT_N = 8192;

/** Hann-windowed magnitude spectrum of `len` samples from `start`, zero-padded to FFT_N. */
function spectrum(x: Float32Array, start: number, len: number): Float64Array {
  const re = new Float64Array(FFT_N);
  const im = new Float64Array(FFT_N);
  for (let i = 0; i < len && start + i < x.length; i++) {
    if (start + i < 0) continue;
    re[i] = x[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1)));
  }
  fft(re, im);
  const mag = new Float64Array(FFT_N / 2);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]) / len;
  return mag;
}

export const MIN_MIDI = 36;
export const MAX_MIDI = 90;

/**
 * Harmonic-sum salience of every pitch in [MIN_MIDI, MAX_MIDI] for a spectrum
 * of new energy: the strongest bin near each of the first six harmonics,
 * weighted toward the lower ones.
 */
function salience(d: Float64Array, sr: number): Float64Array {
  const out = new Float64Array(MAX_MIDI - MIN_MIDI + 1);
  const binHz = sr / FFT_N;
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
    const f0 = 440 * Math.pow(2, (m - 69) / 12);
    let s = 0;
    for (let k = 1; k <= 8; k++) {
      const f = k * f0;
      const lo = Math.max(1, Math.floor((f * Math.pow(2, -1 / 36)) / binHz));
      const hi = Math.min(d.length - 1, Math.ceil((f * Math.pow(2, 1 / 36)) / binHz));
      let peak = 0;
      for (let b = lo; b <= hi; b++) peak = Math.max(peak, d[b]);
      s += peak / Math.pow(k, 0.35);
    }
    out[m - MIN_MIDI] = s;
  }
  return out;
}

export interface Onset {
  time: number;
  /** Most salient new pitch. */
  midi: number;
  /** Salience of every pitch from MIN_MIDI to MAX_MIDI, in the new energy only. */
  sal: Float64Array;
  /** Salience in everything sounding just after the attack (helps with re-picked notes). */
  salAll: Float64Array;
}

/**
 * Find note onsets in a recording and what was played at each one.
 * Attacks are found on a high-frequency energy envelope; the pitch is judged
 * from the spectrum just after the attack minus the spectrum just before, so
 * strings still ringing from earlier notes do not get in the way.
 * `t0` is the audio-clock time of the first sample.
 */
export function analyzeRecording(x: Float32Array, sr: number, t0 = 0): Onset[] {
  const hop = 256;
  const env: number[] = [];
  for (let i = 0; i + hop <= x.length; i += hop) {
    let s = 0;
    for (let j = i + 1; j < i + hop; j++) s += Math.abs(x[j] - x[j - 1]);
    env.push(s / hop);
  }
  const max = env.reduce((a, b) => Math.max(a, b), 0);
  const floor = Math.max(1e-4, max * 0.04);
  const minGap = Math.round((0.05 * sr) / hop);
  const starts: number[] = [];
  for (let i = 4; i < env.length; i++) {
    const before = Math.min(env[i - 1], env[i - 2], env[i - 3], env[i - 4]);
    const rising = env[i] > floor && env[i] > before * 2.2 && env[i] >= env[i - 1];
    if (rising && (!starts.length || i - starts[starts.length - 1] >= minGap)) starts.push(i);
  }
  return starts.map((i, k) => {
    const at = i * hop;
    const next = k + 1 < starts.length ? starts[k + 1] * hop : x.length;
    const len = Math.max(1024, Math.min(4096, next - at - Math.round(0.006 * sr)));
    const offset = Math.round(0.008 * sr);
    const after = spectrum(x, at + offset, len);
    const before = spectrum(x, at - len, len);
    const d = new Float64Array(after.length);
    for (let b = 0; b < d.length; b++) d[b] = Math.max(0, after[b] - before[b]);
    const sal = salience(d, sr);
    let best = 0;
    for (let m = 1; m < sal.length; m++) if (sal[m] > sal[best]) best = m;
    return { time: t0 + at / sr, midi: best + MIN_MIDI, sal, salAll: salience(after, sr) };
  });
}

/**
 * Grade from onsets with pitch salience. A note counts as right when the
 * expected pitch is the strongest new pitch, or nearly as strong as it
 * (low guitar notes often have a weak fundamental).
 */
export function gradeOnsets(expected: { time: number; midi: number }[], onsets: Onset[], window: number): GradeSummary {
  const salOf = (o: Onset, m: number) => (m >= MIN_MIDI && m <= MAX_MIDI ? o.sal[m - MIN_MIDI] : 0);
  const used = new Set<number>();
  const notes: GradedNote[] = expected.map((e) => {
    let best = -1;
    let bestDt = Infinity;
    onsets.forEach((o, k) => {
      if (used.has(k)) return;
      const dt = Math.abs(o.time - e.time);
      if (dt <= window && dt < bestDt) {
        bestDt = dt;
        best = k;
      }
    });
    if (best < 0) return { expected: e, verdict: 'missed' as const };
    used.add(best);
    const o = onsets[best];
    const offsetMs = Math.round((o.time - e.time) * 1000);
    const top = salOf(o, o.midi);
    const maxAll = o.salAll.reduce((a, b) => Math.max(a, b), 0);
    const allOf = (m: number) => (m >= MIN_MIDI && m <= MAX_MIDI ? o.salAll[m - MIN_MIDI] : 0);
    // Re-picking a note that is still ringing adds little new energy, so also accept it
    // when it is clearly the loudest thing sounding right after the attack.
    if (o.midi === e.midi || salOf(o, e.midi) >= 0.6 * top || allOf(e.midi) >= 0.85 * maxAll) return { expected: e, verdict: 'hit' as const, offsetMs, played: e.midi };
    if ((o.midi - e.midi) % 12 === 0) return { expected: e, verdict: 'octave' as const, offsetMs, played: o.midi };
    return { expected: e, verdict: 'wrong' as const, played: o.midi };
  });
  const hits = notes.filter((n) => n.verdict === 'hit');
  const offs = hits.map((n) => n.offsetMs!);
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  return { notes, hits: hits.length, accuracy: expected.length ? hits.length / expected.length : 0, meanAbsMs: mean(offs.map(Math.abs)), meanMs: mean(offs) };
}
