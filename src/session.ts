/**
 * The practice-session runner: which plan is running, which step, and how
 * long is left. It keeps going while you move between pages, survives a page
 * reload, and writes finished sessions to the practice log.
 */
import { PLANS, planById, type Plan, type PlanStep } from './content/plans';
import { type LogEntry, localDate } from './sessionlog';
import { playNote } from './audio';

export interface ActiveSession {
  planId: string;
  /** Minutes per step, as adjusted before starting. */
  minutes: number[];
  index: number;
  /** Seconds left in the current step (0 once time is up). */
  remaining: number;
  running: boolean;
  /** Seconds actually spent with the timer running. */
  active: number;
  /** Steps that ran to time or were moved past. */
  done: number;
}

const ACTIVE_KEY = 'fretwise:session';
const LOG_KEY = 'fretwise:practice-log';
const MINUTES_KEY = 'fretwise:plan-minutes';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable; the session still runs, it just will not persist */
  }
}

let active: ActiveSession | null = read<ActiveSession | null>(ACTIVE_KEY, null);
if (active && !planById(active.planId)) active = null;
// A session restored after a reload starts paused.
if (active) active.running = false;

let timer: number | undefined;
let lastFinished: LogEntry | null = null;
const listeners: (() => void)[] = [];
export const onSessionChange = (l: () => void): void => void listeners.push(l);
const emit = () => listeners.forEach((l) => l());

export const current = (): ActiveSession | null => active;
export const currentPlan = (): Plan | null => (active ? planById(active.planId) ?? null : null);
export const currentStep = (): PlanStep | null => {
  const plan = currentPlan();
  return plan && active ? plan.steps[active.index] ?? null : null;
};

/* ---------- Per-plan minute adjustments ---------- */

export function planMinutes(plan: Plan): number[] {
  const saved = read<Record<string, Record<string, number>>>(MINUTES_KEY, {})[plan.id] ?? {};
  return plan.steps.map((s) => saved[s.id] ?? s.minutes);
}

export function setStepMinutes(plan: Plan, stepId: string, minutes: number): void {
  const all = read<Record<string, Record<string, number>>>(MINUTES_KEY, {});
  all[plan.id] = { ...(all[plan.id] ?? {}), [stepId]: Math.max(1, Math.min(60, Math.round(minutes))) };
  write(MINUTES_KEY, all);
  emit();
}

export function resetMinutes(plan: Plan): void {
  const all = read<Record<string, Record<string, number>>>(MINUTES_KEY, {});
  delete all[plan.id];
  write(MINUTES_KEY, all);
  emit();
}

/* ---------- Transport ---------- */

function tick(): void {
  if (!active || !active.running) return;
  active.active++;
  if (active.remaining > 0) {
    active.remaining--;
    if (active.remaining === 0) chime();
  }
  if (active.active % 5 === 0) write(ACTIVE_KEY, active);
  emit();
}

function ensureTimer(): void {
  if (timer === undefined) timer = window.setInterval(tick, 1000);
}

/** Two soft notes when a step's time is up. */
function chime(): void {
  playNote(76, 0, 0.5);
  playNote(83, 0.18, 0.5);
}

export function start(planId: string): void {
  const plan = planById(planId) ?? PLANS[0];
  const minutes = planMinutes(plan);
  active = { planId: plan.id, minutes, index: 0, remaining: minutes[0] * 60, running: true, active: 0, done: 0 };
  write(ACTIVE_KEY, active);
  ensureTimer();
  emit();
}

export function toggle(): void {
  if (!active) return;
  active.running = !active.running;
  if (active.running) ensureTimer();
  write(ACTIVE_KEY, active);
  emit();
}

export function next(): void {
  if (!active) return;
  const plan = currentPlan()!;
  active.done = Math.max(active.done, active.index + 1);
  if (active.index + 1 >= plan.steps.length) {
    finish();
    return;
  }
  active.index++;
  active.remaining = active.minutes[active.index] * 60;
  active.running = true;
  ensureTimer();
  write(ACTIVE_KEY, active);
  emit();
}

export function previous(): void {
  if (!active || active.index === 0) return;
  active.index--;
  active.remaining = active.minutes[active.index] * 60;
  write(ACTIVE_KEY, active);
  emit();
}

/** End the session and log it (anything under a minute is not logged). */
export function finish(): LogEntry | null {
  if (!active) return null;
  const plan = currentPlan();
  const minutes = Math.round(active.active / 60);
  let entry: LogEntry | null = null;
  if (plan && minutes >= 1) {
    entry = { date: localDate(new Date()), planId: plan.id, planName: plan.name, minutes, steps: active.done, total: plan.steps.length };
    write(LOG_KEY, [...readLog(), entry]);
  }
  active = null;
  write(ACTIVE_KEY, null);
  window.clearInterval(timer);
  timer = undefined;
  lastFinished = entry;
  emit();
  return entry;
}

/** The session that just ended, for a "nice work" message. Cleared once read. */
export function takeLastFinished(): LogEntry | null {
  const e = lastFinished;
  lastFinished = null;
  return e;
}

export const readLog = (): LogEntry[] => read<LogEntry[]>(LOG_KEY, []);

export function clearLog(): void {
  write(LOG_KEY, null);
  emit();
}

export const formatClock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

if (active) ensureTimer();
