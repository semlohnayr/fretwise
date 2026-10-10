import { describe, it, expect } from 'vitest';
import { rampTempo, rampLength, tickLevel, tickSeconds, tapTempo, bounce, clampBpm } from '../src/theory/tempo';

describe('tempo helpers', () => {
  const ramp = { from: 80, to: 100, step: 5, every: 4 };

  it('climbs by a step every few bars and holds at the target', () => {
    expect([0, 3, 4, 7, 8, 12, 16, 40].map((b) => rampTempo(ramp, b))).toEqual([80, 80, 85, 85, 90, 95, 100, 100]);
    expect(rampTempo({ from: 80, to: 102, step: 5, every: 1 }, 10)).toBe(102);
    expect(rampLength(ramp)).toBe(16);
  });

  it('can ramp downward', () => {
    expect(rampTempo({ from: 120, to: 100, step: 10, every: 2 }, 2)).toBe(110);
    expect(rampTempo({ from: 120, to: 100, step: 10, every: 2 }, 50)).toBe(100);
  });

  it('accents the downbeat and marks subdivisions', () => {
    // 4 beats of eighths: ticks 0..7
    expect([0, 1, 2, 3, 4].map((t) => tickLevel(t, 2, true))).toEqual([2, 0, 1, 0, 1]);
    expect(tickLevel(0, 2, false)).toBe(1);
    expect(tickSeconds(120, 2)).toBeCloseTo(0.25);
  });

  it('estimates tap tempo from recent taps', () => {
    expect(tapTempo([0])).toBeNull();
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    // A long pause starts a new measurement.
    expect(tapTempo([0, 300, 5000, 5600, 6200])).toBe(100);
    // One sloppy tap does not throw it off.
    expect(tapTempo([0, 500, 1000, 1700, 2200, 2700])).toBe(120);
  });

  it('clamps tempo and bounces runs', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(300);
    expect(bounce([1, 2, 3, 4])).toEqual([1, 2, 3, 4, 3, 2]);
    expect(bounce([1, 2])).toEqual([1, 2]);
  });
});
