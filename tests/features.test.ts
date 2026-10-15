import { describe, it, expect } from 'vitest';
import {
  n, pc, noteName, TUNINGS, stringMidis, threeNps, scaleById, chordVoicings, voicingName, chordNotes, chordById,
  capoOptions, translateCapo, keyLabel, seeded, noteFindQuestion, fretIntervalQuestion, earIntervalQuestion,
  cagedChordShapes, CAGED_CHORDS, CAGED_CHORD_IDS, movableShape,
  chordQuizQuestion, fretPc, BASIC_INTERVALS, parseTuning,
} from '../src/theory';
import { renderString, midiToHz } from '../src/audio';

const std = TUNINGS[0];
const byId = (id: string) => TUNINGS.find((t) => t.id === id)!;
const semis = (id: string) => scaleById(id).formula.map((i) => i.semitones);
const tones = (root: string, chord: string) => chordNotes(n(root), chordById(chord)).map(pc);

describe('absolute string pitches', () => {
  it('places standard and open tunings in the right octaves', () => {
    expect(stringMidis(std)).toEqual([40, 45, 50, 55, 59, 64]);
    expect(stringMidis(byId('open-g'))).toEqual([38, 43, 50, 55, 59, 62]);
    expect(stringMidis(byId('drop-c'))).toEqual([36, 43, 48, 53, 57, 62]);
    expect(stringMidis(parseTuning('B E A D G B E'))).toEqual([35, 40, 45, 50, 55, 59, 64]);
  });
});

describe('three notes per string', () => {
  const g = threeNps(std, pc(n('G')), semis('ionian'), 22);

  it('builds seven positions', () => {
    expect(g.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('spells position 1 of G major from the 3rd fret', () => {
    expect(g[0].frets).toEqual([[3, 5, 7], [3, 5, 7], [4, 5, 7], [4, 5, 7], [5, 7, 8], [5, 7, 8]]);
  });

  it('plays every scale degree once per octave, ascending', () => {
    const opens = stringMidis(std);
    const scalePcs = new Set(semis('ionian').map((s) => (7 + s) % 12));
    for (const p of g) {
      const pitches = p.frets.flatMap((fs, s) => fs.map((f) => opens[s] + f));
      for (let i = 1; i < pitches.length; i++) expect(pitches[i]).toBeGreaterThan(pitches[i - 1]);
      pitches.forEach((x) => expect(scalePcs.has(x % 12)).toBe(true));
    }
  });

  it('skips scales without seven notes', () => {
    expect(threeNps(std, 9, semis('minor-pentatonic'), 22)).toEqual([]);
  });
});

describe('chord voicings', () => {
  it('finds the familiar open and barre shapes', () => {
    const names = (r: string, c: string) => chordVoicings(std, tones(r, c)).map(voicingName);
    expect(names('C', 'maj')).toContain('x32010');
    expect(names('G', 'maj')).toContain('320003');
    expect(names('A', 'min')).toContain('x02210');
    expect(names('E', 'maj7')).toContain('021100');
    expect(names('F', 'maj')).toContain('133211');
    expect(names('B', 'm7b5')).toContain('x20201');
  });

  it('only uses chord tones, with the root in the bass and no gaps', () => {
    for (const [r, c] of [['C', 'maj'], ['D', '7'], ['F#', 'min'], ['Bb', 'maj7'], ['E', '9']] as const) {
      const t = tones(r, c);
      for (const v of chordVoicings(std, t)) {
        const played = v.frets.map((f, i) => (f === null ? -1 : i)).filter((i) => i >= 0);
        expect(played[played.length - 1] - played[0] + 1).toBe(played.length);
        expect(fretPc(std, played[0], v.frets[played[0]]!)).toBe(t[0]);
        played.forEach((s) => expect(t).toContain(fretPc(std, s, v.frets[s]!)));
        expect(v.fingers).toBeLessThanOrEqual(4);
      }
    }
  });

  it('works in open tunings', () => {
    expect(chordVoicings(byId('open-g'), tones('G', 'maj')).map(voicingName)).toContain('x00000'); // low D is the 5th, so it is muted for a root-position G
  });
});

describe('capo calculator', () => {
  it('finds shape keys for a sounding key', () => {
    const opts = capoOptions(n('A'), 'major');
    const find = (k: string) => opts.find((o) => noteName(o.shape, true) === k)!.capo;
    expect(find('G')).toBe(2);
    expect(find('A')).toBe(0);
    expect(find('E')).toBe(5);
    expect(find('C')).toBe(9);
    expect(opts[0].capo).toBe(0);
  });

  it('translates chords and spells the sounding key', () => {
    const t = translateCapo(n('G'), 'major', 3);
    expect(keyLabel(t.sounding, 'major')).toBe('B♭');
    expect(t.pairs.map((p) => p.sounds.symbol)).toEqual(['B♭', 'Cm', 'Dm', 'E♭', 'F', 'Gm', 'A°']);
    expect(keyLabel(translateCapo(n('E'), 'minor', 2).sounding, 'minor')).toBe('F♯m');
  });
});

describe('quiz generators', () => {
  const rng = seeded(42);

  it('asks for natural notes when requested', () => {
    for (let i = 0; i < 200; i++) {
      const q = noteFindQuestion(rng, std, 12, true);
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(q.answer);
      expect(q.answer).toBe(fretPc(std, q.string, q.fret));
    }
  });

  it('builds fretboard intervals that match their answer', () => {
    const opens = stringMidis(std);
    for (let i = 0; i < 200; i++) {
      const q = fretIntervalQuestion(rng, std, 12, BASIC_INTERVALS);
      expect(BASIC_INTERVALS).toContain(q.answer);
      expect(opens[q.high.string] + q.high.fret - (opens[q.low.string] + q.low.fret)).toBe(q.answer);
    }
  });

  it('draws ear questions from the allowed pools', () => {
    for (let i = 0; i < 100; i++) {
      expect([3, 4]).toContain(earIntervalQuestion(rng, [3, 4], false).answer);
      expect(['maj', 'min']).toContain(chordQuizQuestion(rng, ['maj', 'min']).chord.id);
    }
  });

  it('is reproducible with a seed', () => {
    const a = seeded(7);
    const b = seeded(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('string synth', () => {
  // Estimate pitch by autocorrelation around the expected period.
  const estimate = (x: Float32Array, sr: number, f0: number) => {
    const P = sr / f0;
    const ac = (l: number) => {
      let s = 0;
      for (let i = 4000; i < 12000; i++) s += x[i] * x[i + l];
      return s;
    };
    let best = -Infinity;
    let lag = 0;
    for (let l = Math.floor(P * 0.9); l <= Math.ceil(P * 1.1); l++) {
      const v = ac(l);
      if (v > best) [best, lag] = [v, l];
    }
    const [a, b, c] = [ac(lag - 1), ac(lag), ac(lag + 1)];
    return sr / (lag + (0.5 * (a - c)) / (a - 2 * b + c));
  };

  it('is in tune across the guitar range', () => {
    const rand = seeded(1);
    for (const m of [40, 52, 64, 76, 84]) {
      const f = estimate(renderString(48000, m, 0.5, rand), 48000, midiToHz(m));
      expect(Math.abs(1200 * Math.log2(f / midiToHz(m)))).toBeLessThan(5);
    }
  });
});

describe('CAGED chord shapes', () => {
  const tones = (root: string, id: string) => chordNotes(n(root), chordById(id)).map(pc);

  it('keeps the classic major and minor positions', () => {
    expect(cagedChordShapes(n('C'), 'maj', 15).slice(0, 5).map((s) => s.name)).toEqual(['C', 'A', 'G', 'E', 'D']);
    expect(cagedChordShapes(n('A'), 'min', 15)[0].frets).toEqual([null, 0, 2, 2, 1, 0]);
  });

  it('moves the open 7th shapes to any root', () => {
    const c7 = cagedChordShapes(n('C'), '7', 15);
    expect(c7.find((s) => s.name === 'C')!.frets).toEqual([null, 3, 2, 3, 1, 0]);
    expect(c7.find((s) => s.name === 'A')!.frets).toEqual([null, 3, 5, 3, 5, 3]);
    expect(c7.find((s) => s.name === 'E')!.frets).toEqual([8, 10, 8, 9, 8, 8]);
    expect(cagedChordShapes(n('B'), 'm7b5', 15).find((s) => s.name === 'A')!.frets).toEqual([null, 2, 3, 2, 3, null]);
  });

  it('every shape for every root is playable and uses only chord tones, root in the bass', () => {
    const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (const id of CAGED_CHORD_IDS) {
      expect(Object.keys(CAGED_CHORDS[id]).length).toBeGreaterThanOrEqual(2);
      for (const root of roots) {
        const t = tones(root, id);
        const shapes = cagedChordShapes(n(root), id, 17);
        // Each defined shape fits somewhere below fret 17.
        expect(new Set(shapes.map((s) => s.name)).size).toBe(Object.keys(CAGED_CHORDS[id]).length);
        for (const sh of shapes) {
          const played = sh.frets.map((f, s) => (f === null ? null : t.indexOf(fretPc(std, s, f))));
          played.forEach((x) => expect(x).not.toBe(-1));
          expect(played.find((x) => x !== null)).toBe(0);
          // Root, 3rd (or its sus/♭ replacement) and the 7th or 6th are always present; only the 5th may be left out.
          t.forEach((_, i) => i !== 2 && expect(played).toContain(i));
          const fretted = sh.frets.filter((f): f is number => f !== null && f > 0);
          if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});

describe('movable chord chart shapes', () => {
  it('describes each shape relative to its root', () => {
    const e7 = movableShape('7', 'E')!;
    expect(e7.ref).toBe(0);
    expect(e7.notes.map((x) => x.semitones)).toEqual([0, 7, 10, 4, 7, 0]);
    expect([e7.lo, e7.hi]).toEqual([0, 2]);
    const c = movableShape('maj', 'C')!;
    expect(c.muted).toEqual([0]);
    expect(c.notes.map((x) => x.semitones)).toEqual([0, 4, 7, 0, 4]);
    expect([c.lo, c.hi]).toEqual([-3, 0]);
    expect(movableShape('m7', 'G')).toBeNull();
  });

  it('only contains notes of the chord', () => {
    for (const id of CAGED_CHORD_IDS) {
      const semis = new Set(chordById(id).formula.map((i) => i.semitones % 12));
      for (const name of ['C', 'A', 'G', 'E', 'D'] as const) {
        movableShape(id, name)?.notes.forEach((x) => expect(semis.has(x.semitones)).toBe(true));
      }
    }
  });
});

describe('CAGED chord list', () => {
  it('lists every chord type with shapes, starting with the triads', () => {
    expect([...CAGED_CHORD_IDS].sort()).toEqual(Object.keys(CAGED_CHORDS).sort());
    expect(CAGED_CHORD_IDS.slice(0, 3)).toEqual(['maj', 'min', '7']);
  });
});
