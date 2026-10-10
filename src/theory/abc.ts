/**
 * A parser for the subset of ABC notation used by fiddle-tune collections:
 * headers (T M L K Q), notes with accidentals, octaves and lengths, rests,
 * ties, broken rhythm (> <), triplets, slurs (read as hammer-ons/pull-offs),
 * double stops (the top note is kept), chord symbols, and repeats with
 * first and second endings. Decorations, grace notes and bowings are skipped.
 */
import { type Note, LETTERS, LETTER_PC } from './notes';
import { parentMajor, scaleById, scaleNotes } from './scales';

export interface MelodyNote {
  /** MIDI pitch, or null for a rest. */
  midi: number | null;
  /** Length in quarter-note beats. */
  dur: number;
  /** Spelling as written (null for rests). */
  spelled: Note | null;
  /** Chord symbol starting on this note, if any. */
  chord?: string;
  /** Slurred to the previous note: played as a hammer-on or pull-off, not picked. */
  legato?: boolean;
}

export interface Measure {
  notes: MelodyNote[];
  startRepeat: boolean;
  endRepeat: boolean;
  /** The bar line after this measure ends a part (|| or |]). */
  doubleBar: boolean;
  ending?: number;
}

export interface Tune {
  title: string;
  key: Note;
  mode: string;
  /** Quarter-note beats per bar. */
  beatsPerBar: number;
  meter: string;
  /** Tempo hint from Q:, in quarter notes per minute, if given. */
  tempo?: number;
  measures: Measure[];
}

const MODE_ALIASES: Record<string, string> = {
  '': 'ionian', maj: 'ionian', ion: 'ionian', m: 'aeolian', min: 'aeolian', aeo: 'aeolian',
  mix: 'mixolydian', dor: 'dorian', phr: 'phrygian', lyd: 'lydian', loc: 'locrian',
};

/** "D", "Dmaj", "Amix", "A mixolydian", "Em", "Ador" → root + mode id. */
export function parseKey(k: string): { key: Note; mode: string } {
  const m = /^\s*([A-Ga-g])([#b♯♭]?)\s*([A-Za-z]*)/.exec(k);
  if (!m) return { key: { letter: 0, acc: 0 }, mode: 'ionian' };
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]);
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const word = m[3].toLowerCase();
  const mode = MODE_ALIASES[word === 'm' ? 'm' : word.slice(0, 3)] ?? 'ionian';
  return { key: { letter, acc }, mode };
}

/** Accidental for each letter (C..B) implied by a key signature. */
export function keyAccidentals(key: Note, mode: string): number[] {
  const parent = parentMajor(key, mode);
  const acc = new Array(7).fill(0);
  for (const x of scaleNotes(parent, scaleById('ionian'))) acc[x.letter] = x.acc;
  return acc;
}

function parseMeter(m: string): { beats: number; label: string } {
  const t = m.trim();
  if (t === 'C') return { beats: 4, label: '4/4' };
  if (t === 'C|') return { beats: 4, label: '2/2' };
  const f = /^(\d+)\/(\d+)$/.exec(t);
  if (f) return { beats: (Number(f[1]) * 4) / Number(f[2]), label: t };
  return { beats: 4, label: '4/4' };
}

function parseFraction(s: string): number {
  const f = /^(\d+)\/(\d+)$/.exec(s.trim());
  return f ? Number(f[1]) / Number(f[2]) : 1 / 8;
}

export function parseAbc(src: string): Tune {
  const lines = src.split(/\r?\n/);
  let title = 'Untitled';
  let meter = parseMeter('4/4');
  let unit = 1 / 8;
  let unitSet = false;
  let tempo: number | undefined;
  let key = parseKey('C');
  const body: string[] = [];
  let inBody = false;

  for (const raw of lines) {
    const line = raw.replace(/%.*$/, '');
    const field = /^([A-Za-z]):\s*(.*)$/.exec(line.trim());
    if (field && (!inBody || 'KLMQ'.includes(field[1])) && !/^[|:[]/.test(line.trim())) {
      const [, f, v] = field;
      if (f === 'T' && title === 'Untitled') title = v.trim();
      else if (f === 'M') meter = parseMeter(v);
      else if (f === 'L') {
        unit = parseFraction(v);
        unitSet = true;
      } else if (f === 'Q') {
        const q = /(\d+)\s*$/.exec(v);
        if (q) tempo = Number(q[1]);
      } else if (f === 'K') {
        key = parseKey(v);
        inBody = true;
      }
      continue;
    }
    if (inBody) body.push(line);
  }
  if (!unitSet && meter.beats < 3) unit = 1 / 16;

  let sig = keyAccidentals(key.key, key.mode);
  const measures: Measure[] = [];
  let cur: Measure = { notes: [], startRepeat: false, endRepeat: false, doubleBar: false };
  let barAcc = new Map<string, number>();
  let pendingChord: string | undefined;
  let pendingEnding: number | undefined;
  let activeEnding: number | undefined;
  let tuplet = 0;
  let tupletFactor = 1;
  let slur = false;
  let slurStart = false;
  let broken = 0; // next note's length multiplier from a broken rhythm marker
  let tieNext = false;

  const text = body.join(' ');
  let i = 0;

  const closeMeasure = (bar: string, endingDigit?: number) => {
    const endRep = /:\|/.test(bar) || bar.startsWith('::');
    const startRep = /\|:/.test(bar) || bar.endsWith('::');
    const dbl = /\|\||\|\]|\[\|/.test(bar);
    cur.endRepeat = endRep;
    cur.doubleBar = dbl;
    if (cur.notes.length || cur.endRepeat || cur.doubleBar) measures.push(cur);
    // Endings run until a repeat, a double bar or a new ending starts.
    if (endRep || dbl || startRep) activeEnding = undefined;
    if (endingDigit !== undefined) activeEnding = endingDigit;
    if (pendingEnding !== undefined) {
      activeEnding = pendingEnding;
      pendingEnding = undefined;
    }
    cur = { notes: [], startRepeat: startRep, endRepeat: false, doubleBar: false, ending: activeEnding };
    barAcc = new Map();
  };

  const readLength = (): number => {
    let num = 1;
    let den = 1;
    const d = /^\d+/.exec(text.slice(i));
    if (d) {
      num = Number(d[0]);
      i += d[0].length;
    }
    while (text[i] === '/') {
      i++;
      const dd = /^\d+/.exec(text.slice(i));
      if (dd) {
        den *= Number(dd[0]);
        i += dd[0].length;
      } else den *= 2;
    }
    return num / den;
  };

  /** Parse one note head (accidental, letter, octave) at i; returns midi + spelling or null. */
  const readPitch = (): { midi: number; spelled: Note } | null => {
    let explicit: number | undefined;
    const accM = /^(\^\^|\^|__|_|=)/.exec(text.slice(i));
    if (accM) {
      explicit = { '^^': 2, '^': 1, '__': -2, _: -1, '=': 0 }[accM[1]];
      i += accM[1].length;
    }
    const ch = text[i];
    if (!ch || !/[A-Ga-g]/.test(ch)) return null;
    i++;
    const letter = LETTERS.indexOf(ch.toUpperCase() as (typeof LETTERS)[number]);
    let octave = ch === ch.toLowerCase() ? 5 : 4;
    while (text[i] === "'" || text[i] === ',') {
      octave += text[i] === "'" ? 1 : -1;
      i++;
    }
    const k = `${letter}:${octave}`;
    let acc: number;
    if (explicit !== undefined) {
      acc = explicit;
      barAcc.set(k, explicit);
    } else acc = barAcc.get(k) ?? sig[letter];
    return { midi: 12 * (octave + 1) + LETTER_PC[letter] + acc, spelled: { letter, acc } };
  };

  const push = (n: MelodyNote) => {
    let mult = 1;
    if (tuplet > 0) {
      mult *= tupletFactor;
      tuplet--;
    }
    if (broken) {
      mult *= broken;
      broken = 0;
    }
    n.dur *= mult;
    if (pendingChord) {
      n.chord = pendingChord;
      pendingChord = undefined;
    }
    if (slur && !slurStart && n.midi !== null) n.legato = true;
    if (n.midi !== null) slurStart = false;
    const prev = cur.notes[cur.notes.length - 1];
    if (tieNext && prev && prev.midi === n.midi) {
      prev.dur += n.dur;
      tieNext = false;
      return;
    }
    tieNext = false;
    cur.notes.push(n);
  };

  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c) || c === '`' || c === '\\') {
      i++;
    } else if (c === '"') {
      const end = text.indexOf('"', i + 1);
      const sym = text.slice(i + 1, end < 0 ? text.length : end);
      if (sym && !/^[\^_<>@]/.test(sym)) pendingChord = sym.trim();
      i = end < 0 ? text.length : end + 1;
    } else if (c === '!' || c === '+') {
      const end = text.indexOf(c, i + 1);
      i = end < 0 ? text.length : end + 1;
    } else if (c === '{') {
      const end = text.indexOf('}', i + 1);
      i = end < 0 ? text.length : end + 1;
    } else if (c === '(') {
      const t = /^\((\d)(?::\d*){0,2}/.exec(text.slice(i));
      if (t) {
        const p = Number(t[1]);
        tuplet = p;
        tupletFactor = p === 3 ? 2 / 3 : p === 2 ? 3 / 2 : p === 4 ? 3 / 4 : p === 6 ? 2 / 3 : 1;
        i += t[0].length;
      } else {
        slur = true;
        slurStart = true;
        i++;
      }
    } else if (c === ')') {
      slur = false;
      i++;
    } else if (c === '-') {
      tieNext = true;
      i++;
    } else if (c === '>' || c === '<') {
      let count = 0;
      while (text[i] === c) {
        count++;
        i++;
      }
      const prev = cur.notes[cur.notes.length - 1];
      const long = 2 - Math.pow(0.5, count);
      const short = Math.pow(0.5, count);
      if (prev) prev.dur *= c === '>' ? long : short;
      broken = c === '>' ? short : long;
    } else if (c === '[' && /^\[[A-Za-z]:/.test(text.slice(i))) {
      const end = text.indexOf(']', i);
      const field = text.slice(i + 1, end < 0 ? text.length : end);
      if (field.startsWith('K:')) {
        key = parseKey(field.slice(2));
        sig = keyAccidentals(key.key, key.mode);
      }
      i = end < 0 ? text.length : end + 1;
    } else if (c === '[' && /^\[\d/.test(text.slice(i))) {
      pendingEnding = Number(text[i + 1]);
      // A "[1" straight after a bar line applies to the measure that just opened.
      if (!cur.notes.length) {
        cur.ending = pendingEnding;
        activeEnding = pendingEnding;
        pendingEnding = undefined;
      }
      i += 2;
    } else if (c === '[') {
      // Double stop or chord: keep the highest note as the melody.
      i++;
      let best: { midi: number; spelled: Note } | null = null;
      let len = 1;
      let first = true;
      while (i < text.length && text[i] !== ']') {
        const p = readPitch();
        if (p) {
          const l = readLength();
          if (first) len = l;
          first = false;
          if (!best || p.midi > best.midi) best = p;
        } else i++;
      }
      i++; // ]
      len *= readLength();
      if (best) push({ midi: best.midi, spelled: best.spelled, dur: len * unit * 4 });
    } else if (c === '|' || c === ':' || (c === ']' && text[i - 1] === '|')) {
      const m = /^[|:\]\[]+/.exec(text.slice(i))!;
      let bar = m[0];
      // A trailing "[" starts an ending ("|[1") or a double stop ("|[A2A2]"), not the bar line.
      if (bar.endsWith('[') && !bar.endsWith('[|')) bar = bar.slice(0, -1);
      i += bar.length;
      let endingDigit: number | undefined;
      const d = /^\[?(\d)/.exec(text.slice(i));
      if (d && /^\|/.test(bar.slice(-1)) ) {
        endingDigit = Number(d[1]);
        i += d[0].length;
      }
      closeMeasure(bar, endingDigit);
    } else if (/[\^_=A-Ga-g]/.test(c)) {
      const p = readPitch();
      if (!p) {
        i++;
        continue;
      }
      const l = readLength();
      push({ midi: p.midi, spelled: p.spelled, dur: l * unit * 4 });
    } else if (c === 'z' || c === 'x') {
      i++;
      const l = readLength();
      push({ midi: null, spelled: null, dur: l * unit * 4 });
    } else {
      i++; // decorations, bowings and anything else we do not model
    }
  }
  if (cur.notes.length) measures.push(cur);

  return { title, key: key.key, mode: key.mode, beatsPerBar: meter.beats, meter: meter.label, tempo, measures };
}

/* ---------- Repeats and parts ---------- */

/** Play order with repeats and first/second endings applied. */
export function expandRepeats(measures: Measure[]): Measure[] {
  const out: Measure[] = [];
  let repeatStart = 0;
  let second = false;
  let i = 0;
  let guard = 0;
  while (i < measures.length && guard++ < 10000) {
    const m = measures[i];
    if (m.startRepeat && !second) repeatStart = i;
    if (second && m.ending === 1) {
      i++;
      continue;
    }
    if (second && m.ending === undefined && i > 0 && measures[i - 1].ending === 2) {
      second = false;
      repeatStart = i;
    }
    if (!second && m.ending === 2) {
      // Reached a second ending without having repeated: skip it.
      i++;
      continue;
    }
    out.push(m);
    if (m.endRepeat && !second) {
      second = true;
      i = repeatStart;
      continue;
    }
    if (m.endRepeat && second) {
      second = false;
      repeatStart = i + 1;
    } else if (m.doubleBar) {
      second = false;
      repeatStart = i + 1;
    }
    i++;
  }
  return out;
}

/**
 * Split the written measures into parts (A, B, C...). A part ends at an end
 * repeat that is not followed by a second ending, or at a double bar.
 */
export function splitParts(measures: Measure[]): Measure[][] {
  const parts: Measure[][] = [];
  let cur: Measure[] = [];
  measures.forEach((m, idx) => {
    cur.push(m);
    const next = measures[idx + 1];
    const repeatEnds = m.endRepeat && !(next && next.ending === 2);
    const secondEndingEnds = m.ending === 2 && (!next || next.ending !== 2);
    if (repeatEnds || m.doubleBar || secondEndingEnds) {
      parts.push(cur);
      cur = [];
    }
  });
  if (cur.length) parts.push(cur);
  return parts;
}

/* ---------- Timelines ---------- */

export interface TimedNote extends MelodyNote {
  /** Onset in beats from the start of the timeline. */
  onset: number;
  /** Index of the measure (in the played order) this note belongs to. */
  bar: number;
}

export interface Timeline {
  notes: TimedNote[];
  /** Beats from the first downbeat to the first note (a pickup starts before bar 1). */
  offset: number;
  /** Beats per loop, a whole number of bars. */
  length: number;
  beatsPerBar: number;
  /** Chord in effect at each onset, for backing tracks. */
  chords: { onset: number; symbol: string }[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Lay measures end to end. A short first measure is treated as a pickup. */
export function timeline(measures: Measure[], beatsPerBar: number): Timeline {
  const firstLen = measures.length ? sum(measures[0].notes.map((n) => n.dur)) : 0;
  const pickup = firstLen > 0 && firstLen < beatsPerBar - 1e-6 && measures.length > 1;
  const offset = pickup ? beatsPerBar - firstLen : 0;
  const notes: TimedNote[] = [];
  const chords: { onset: number; symbol: string }[] = [];
  let t = offset;
  measures.forEach((m, bar) => {
    for (const n of m.notes) {
      notes.push({ ...n, onset: t, bar });
      if (n.chord) chords.push({ onset: t, symbol: n.chord });
      t += n.dur;
    }
  });
  const total = t - offset;
  const length = Math.max(beatsPerBar, Math.ceil((total - 1e-6) / beatsPerBar) * beatsPerBar);
  return { notes, offset, length, beatsPerBar, chords };
}

/** Transpose a timeline's pitches (spellings are recomputed by the caller if needed). */
export function shiftTimeline(tl: Timeline, semitones: number): Timeline {
  return { ...tl, notes: tl.notes.map((n) => ({ ...n, midi: n.midi === null ? null : n.midi + semitones })) };
}
