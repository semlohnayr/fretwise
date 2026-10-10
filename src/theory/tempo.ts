/** Pure helpers for the metronome, kept free of audio and DOM so they can be tested. */

export const MIN_BPM = 30;
export const MAX_BPM = 300;

export const clampBpm = (bpm: number): number => Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)));

export interface RampSettings {
  from: number;
  to: number;
  /** BPM added at each step. */
  step: number;
  /** Bars played at each tempo before stepping up. */
  every: number;
}

/**
 * Tempo for a given bar (0-based) of a ramp. It climbs by `step` every
 * `every` bars and holds once it reaches the target. Works downward too,
 * if `to` is below `from` (useful for slowing a passage back down).
 */
export function rampTempo(r: RampSettings, bar: number): number {
  const steps = Math.floor(bar / Math.max(1, r.every));
  const dir = r.to >= r.from ? 1 : -1;
  const raw = r.from + dir * Math.abs(r.step) * steps;
  return clampBpm(dir > 0 ? Math.min(raw, r.to) : Math.max(raw, r.to));
}

/** First bar at which a ramp reaches its target (useful for showing progress). */
export function rampLength(r: RampSettings): number {
  if (r.step === 0 || r.from === r.to) return 0;
  return Math.ceil(Math.abs(r.to - r.from) / Math.abs(r.step)) * Math.max(1, r.every);
}

/** Click level for a tick: 2 = first beat of the bar, 1 = other beats, 0 = subdivisions. */
export function tickLevel(tickInBar: number, subdivision: number, accentFirst: boolean): 0 | 1 | 2 {
  if (tickInBar % subdivision !== 0) return 0;
  return tickInBar === 0 && accentFirst ? 2 : 1;
}

/** Seconds between ticks. */
export const tickSeconds = (bpm: number, subdivision: number): number => 60 / bpm / subdivision;

/**
 * Tempo from tap times in milliseconds: the median gap of the last few taps,
 * ignoring anything before a pause of more than two seconds.
 */
export function tapTempo(times: number[]): number | null {
  let start = times.length - 1;
  while (start > 0 && times[start] - times[start - 1] <= 2000 && times.length - start < 6) start--;
  const recent = times.slice(start);
  if (recent.length < 2) return null;
  const gaps = recent.slice(1).map((t, i) => t - recent[i]).sort((a, b) => a - b);
  const mid = gaps[Math.floor(gaps.length / 2)];
  const median = gaps.length % 2 ? mid : (gaps[gaps.length / 2 - 1] + mid) / 2;
  return clampBpm(60000 / median);
}

/** Up then back down without repeating the turnaround notes: [a, b, c] → [a, b, c, b]. Loops cleanly. */
export function bounce<T>(xs: T[]): T[] {
  return xs.length < 3 ? [...xs] : [...xs, ...xs.slice(1, -1).reverse()];
}
