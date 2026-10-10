/** Practice log helpers. Pure functions over a list of entries, so they can be tested. */

export interface LogEntry {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  planId: string;
  planName: string;
  minutes: number;
  /** Steps finished out of the plan's total. */
  steps: number;
  total: number;
}

export function localDate(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Minutes practiced on each of the last `days` days, oldest first. */
export function dailyMinutes(log: LogEntry[], today: Date, days: number): { date: string; minutes: number }[] {
  const byDate = new Map<string, number>();
  for (const e of log) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.minutes);
  return Array.from({ length: days }, (_, i) => {
    const date = localDate(addDays(today, i - days + 1));
    return { date, minutes: byDate.get(date) ?? 0 };
  });
}

/**
 * Consecutive days with practice, counting back from today. If today has no
 * practice yet, the streak still counts from yesterday (it is not broken until
 * a whole day is missed).
 */
export function streak(log: LogEntry[], today: Date): number {
  const days = new Set(log.filter((e) => e.minutes > 0).map((e) => e.date));
  let d = days.has(localDate(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(localDate(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export const weekMinutes = (log: LogEntry[], today: Date): number =>
  dailyMinutes(log, today, 7).reduce((a, d) => a + d.minutes, 0);
