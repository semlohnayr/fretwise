import { describe, it, expect } from 'vitest';
import { streak, dailyMinutes, weekMinutes, localDate, type LogEntry } from '../src/sessionlog';
import { PLANS } from '../src/content/plans';
import { WARMUPS } from '../src/content/warmups';
import { TUNES } from '../src/content/tunes';
import { LICKS } from '../src/content/licks';

const entry = (date: string, minutes: number): LogEntry => ({ date, minutes, planId: 'x', planName: 'X', steps: 1, total: 1 });
const today = new Date(2026, 9, 10); // 10 Oct 2026, local time

describe('practice log', () => {
  it('formats local dates', () => {
    expect(localDate(today)).toBe('2026-10-10');
  });

  it('counts a streak back from today, or from yesterday if today is still empty', () => {
    const log = [entry('2026-10-08', 10), entry('2026-10-09', 15), entry('2026-10-10', 5)];
    expect(streak(log, today)).toBe(3);
    expect(streak(log.slice(0, 2), today)).toBe(2);
    expect(streak([entry('2026-10-07', 10)], today)).toBe(0);
    expect(streak([], today)).toBe(0);
  });

  it('crosses month boundaries', () => {
    const log = ['2026-09-29', '2026-09-30', '2026-10-01'].map((d) => entry(d, 5));
    expect(streak(log, new Date(2026, 9, 1))).toBe(3);
  });

  it('totals minutes per day and per week', () => {
    const log = [entry('2026-10-10', 10), entry('2026-10-10', 5), entry('2026-10-04', 20), entry('2026-10-03', 99)];
    const days = dailyMinutes(log, today, 7);
    expect(days.map((d) => d.date)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
    expect(days[6].minutes).toBe(15);
    expect(weekMinutes(log, today)).toBe(35);
  });
});

describe('plans and warm-ups', () => {
  it('every step links to something that exists', () => {
    for (const plan of PLANS) {
      expect(plan.steps.length).toBeGreaterThan(2);
      for (const step of plan.steps) {
        expect(step.minutes).toBeGreaterThan(0);
        const o = step.open;
        if (!o) continue;
        if (o.warmupId) expect(WARMUPS.some((w) => w.id === o.warmupId)).toBe(true);
        if (o.tuneId) expect(TUNES.some((t) => t.id === o.tuneId)).toBe(true);
        if (o.lickId) expect(LICKS.some((l) => l.id === o.lickId)).toBe(true);
      }
    }
  });

  it('plans add up to their advertised lengths', () => {
    const total = (id: string) => PLANS.find((p) => p.id === id)!.steps.reduce((a, s) => a + s.minutes, 0);
    expect(total('quick-15')).toBe(15);
    expect(total('balanced-30')).toBe(30);
    expect(total('speed-25')).toBe(25);
    expect(total('tune-40')).toBe(40);
    expect(total('neck-20')).toBe(20);
  });

  it('warm-ups stay on the neck and keep one finger per fret', () => {
    for (const w of WARMUPS) {
      for (const start of w.movable ? [1, 5, 9] : [0]) {
        const cells = w.cells(start);
        expect(cells.length).toBeGreaterThan(8);
        for (const c of cells) {
          expect(c.string).toBeGreaterThanOrEqual(1);
          expect(c.string).toBeLessThanOrEqual(6);
          expect(c.fret).toBeGreaterThanOrEqual(0);
          expect(c.fret).toBeLessThanOrEqual(15);
        }
        if (w.id.startsWith('spider')) {
          // Four frets per string, all within one hand position.
          const frets = new Set(cells.map((c) => c.fret));
          expect([...frets].sort((a, b) => a - b)).toEqual([start, start + 1, start + 2, start + 3]);
        }
      }
    }
  });
});
