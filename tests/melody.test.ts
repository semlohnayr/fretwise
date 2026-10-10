import { describe, it, expect } from 'vitest';
import {
  parseAbc, expandRepeats, splitParts, timeline, parseKey, keyAccidentals, noteName,
  autoTab, alternatePicks, economyPicks, patternPicks, TUNINGS, stringMidis,
  randomMelody, scaleRange, seeded, parseChordSymbol, progressionSpans, boomChuck, chordSpans,
  detectPitch, segmentNotes, grade, median, n, analyzeRecording, gradeOnsets,
} from '../src/theory';
import { renderString } from '../src/audio';
import { TUNES } from '../src/content/tunes';
import { LICKS } from '../src/content/licks';

const std = TUNINGS[0];
const pitchesOf = (abc: string) => parseAbc(abc).measures.flatMap((m) => m.notes.map((x) => x.midi));

describe('ABC parser', () => {
  it('reads keys and modes', () => {
    expect(parseKey('Amix')).toEqual({ key: n('A'), mode: 'mixolydian' });
    expect(parseKey('A mixolydian').mode).toBe('mixolydian');
    expect(parseKey('Em').mode).toBe('aeolian');
    expect(parseKey('Dmaj').mode).toBe('ionian');
    expect(keyAccidentals(n('D'), 'ionian')).toEqual([1, 0, 0, 1, 0, 0, 0]); // C# and F#
    expect(keyAccidentals(n('A'), 'mixolydian')).toEqual([1, 0, 0, 1, 0, 0, 0]); // same as D major
  });

  it('reads pitches, octaves and key signature', () => {
    // K:D makes F and C sharp; c' is two octaves above middle C.
    expect(pitchesOf('K:D\nC D F c f c\' C, z')).toEqual([61, 62, 66, 73, 78, 85, 49, null]);
  });

  it('keeps accidentals to the end of the bar only', () => {
    expect(pitchesOf('K:C\n^F F | F')).toEqual([66, 66, 65]);
    expect(pitchesOf('K:G\n=F F | F')).toEqual([65, 65, 66]);
  });

  it('reads lengths, broken rhythm, triplets and ties', () => {
    const durs = (abc: string) => parseAbc(abc).measures.flatMap((m) => m.notes.map((x) => x.dur));
    expect(durs('L:1/8\nK:C\nA A2 A/ A3/2 A//')).toEqual([0.5, 1, 0.25, 0.75, 0.125]);
    expect(durs('L:1/8\nK:C\nA>B A<B')).toEqual([0.75, 0.25, 0.25, 0.75]);
    expect(durs('L:1/8\nK:C\n(3ABc d').map((d) => +d.toFixed(4))).toEqual([0.3333, 0.3333, 0.3333, 0.5]);
    expect(durs('L:1/8\nK:C\nA2-A2 B')).toEqual([2, 0.5]);
  });

  it('marks slurred notes as hammer-ons or pull-offs', () => {
    const notes = parseAbc('K:G\n(AB) c').measures[0].notes;
    expect(notes.map((x) => !!x.legato)).toEqual([false, true, false]);
  });

  it('keeps the top note of a double stop and reads chord symbols', () => {
    const notes = parseAbc('L:1/8\nK:C\n"Am"[A2c2] "G"B').measures[0].notes;
    expect(notes.map((x) => x.midi)).toEqual([72, 71]);
    expect(notes.map((x) => x.dur)).toEqual([1, 0.5]);
    expect(notes.map((x) => x.chord)).toEqual(['Am', 'G']);
  });

  it('skips decorations, grace notes and bowings', () => {
    expect(pitchesOf('K:C\n{g}A !trill!B ~c +slide+d uv e')).toEqual([69, 71, 72, 74, 76]);
  });

  it('expands repeats and first/second endings', () => {
    const t = parseAbc('L:1/4\nK:C\n|:C D|1 E:|2 F||G|');
    const order = expandRepeats(t.measures).map((m) => noteName(m.notes[0].spelled!, true));
    expect(order).toEqual(['C', 'E', 'C', 'F', 'G']);
  });

  it('repeats a part that has no start repeat from the beginning', () => {
    const t = parseAbc('L:1/4\nK:C\nC|D:|E|');
    expect(expandRepeats(t.measures).map((m) => m.notes[0].midi)).toEqual([60, 62, 60, 62, 64]);
  });
});

describe('bundled tunes and licks', () => {
  for (const tune of TUNES) {
    it(`${tune.title} parses into full bars`, () => {
      const t = parseAbc(tune.abc);
      const parts = splitParts(t.measures);
      expect(parts.length).toBe(2);
      for (const part of parts) {
        const tl = timeline(expandRepeats(part), t.beatsPerBar);
        const total = tl.notes.reduce((s, x) => s + x.dur, 0);
        // Old Joe Clark has four-bar parts; the others have eight. Each part is played twice.
        expect(Math.floor(total / t.beatsPerBar)).toBe(tune.id === 'old-joe-clark' ? 8 : 16);
      }
      // Every note should be playable in open position on a standard guitar, with or without its usual capo.
      // Guitar sounds an octave below written pitch.
      const pitches = expandRepeats(t.measures).flatMap((m) => m.notes.map((x) => (x.midi === null ? null : x.midi - 12)));
      const tab = autoTab(std, pitches, { capo: tune.capo ?? 0 });
      pitches.forEach((p, i) => p !== null && expect(tab[i]).not.toBeNull());
    });
  }

  it('licks parse and are playable', () => {
    for (const lick of LICKS) {
      const t = parseAbc(lick.abc);
      const pitches = t.measures.flatMap((m) => m.notes.map((x) => (x.midi === null ? null : x.midi - 12)));
      expect(pitches.length).toBeGreaterThan(2);
      const total = t.measures.flatMap((m) => m.notes).reduce((s, x) => s + x.dur, 0);
      expect(total % 4).toBeCloseTo(0, 6);
      autoTab(std, pitches).forEach((p, i) => pitches[i] !== null && expect(p).not.toBeNull());
    }
  });

  it('plays the G run in its usual first-position shape', () => {
    const lick = LICKS.find((l) => l.id === 'g-run')!;
    const pitches = parseAbc(lick.abc).measures.flatMap((m) => m.notes.map((x) => x.midi! - 12));
    const tab = autoTab(std, pitches);
    expect(tab.map((p) => `${6 - p!.string}:${p!.fret}`)).toEqual(['2:3', '3:0', '4:2', '4:0', '5:1', '5:2', '6:3']);
  });
});

describe('auto tab', () => {
  it('plays a G major scale in open position', () => {
    const g = [43, 45, 47, 48, 50, 52, 54, 55];
    const tab = autoTab(std, g);
    const opens = stringMidis(std);
    tab.forEach((p, i) => expect(opens[p!.string] + p!.fret).toBe(g[i]));
    expect(Math.max(...tab.map((p) => p!.fret))).toBeLessThanOrEqual(4);
  });

  it('stays near a requested position', () => {
    const tab = autoTab(std, [57, 59, 60, 62, 64, 65, 67, 69], { style: 'position', position: 5 });
    tab.forEach((p) => expect(p!.fret).toBeGreaterThanOrEqual(4));
  });

  it('reports frets relative to a capo', () => {
    // A on the 3rd string open position with capo 2 is the "G shape" fret 0.
    const tab = autoTab(std, [57], { capo: 2 });
    expect(tab[0]).toEqual({ string: 3, fret: 0 });
  });

  it('leaves rests and impossible notes empty', () => {
    const tab = autoTab(std, [null, 20, 52]);
    expect(tab[0]).toBeNull();
    expect(tab[1]).toBeNull();
    expect(tab[2]).not.toBeNull();
  });
});

describe('pick direction', () => {
  const eighths = [0, 0.5, 1, 1.5].map((onset, i) => ({ onset, string: i < 2 ? 2 : 3 }));

  it('alternates down on the beat, up off the beat', () => {
    expect(alternatePicks(eighths)).toEqual(['down', 'up', 'down', 'up']);
    // A quarter note followed by eighths still lands down on the beat.
    expect(alternatePicks([{ onset: 0, string: 1 }, { onset: 1, string: 1 }, { onset: 1.5, string: 1 }])).toEqual(['down', 'down', 'up']);
  });

  it('skips hammer-ons', () => {
    expect(alternatePicks([{ onset: 0, string: 1 }, { onset: 0.5, string: 1, legato: true }, { onset: 1, string: 1 }])).toEqual(['down', null, 'down']);
  });

  it('sweeps across adjacent strings in economy picking', () => {
    const notes = [{ onset: 0, string: 2 }, { onset: 0.5, string: 3 }, { onset: 1, string: 3 }, { onset: 1.5, string: 2 }];
    expect(economyPicks(notes)).toEqual(['down', 'down', 'up', 'up']);
  });

  it('applies an explicit pattern', () => {
    expect(patternPicks(eighths, 'DUU')).toEqual(['down', 'up', 'up', 'down']);
  });
});

describe('random melodies', () => {
  const major = [0, 2, 4, 5, 7, 9, 11];
  const opts = { rootPc: 7, scale: major, bars: 4, beatsPerBar: 4, rhythm: 'mixed' as const, low: 43, high: 67 };

  it('fills the bars, stays in the scale and range, and ends on a long root', () => {
    for (let s = 1; s < 40; s++) {
      const mel = randomMelody(seeded(s), opts);
      const total = mel.reduce((a, x) => a + x.dur, 0);
      expect(total).toBeCloseTo(16, 6);
      const inScale = new Set(scaleRange(7, major, 43, 67));
      mel.forEach((x) => expect(inScale.has(x.midi!)).toBe(true));
      const last = mel[mel.length - 1];
      expect(last.midi! % 12).toBe(7);
      expect(last.dur).toBe(2);
    }
  });

  it('moves mostly by step', () => {
    let steps = 0;
    let moves = 0;
    for (let s = 1; s < 40; s++) {
      const mel = randomMelody(seeded(s), opts).map((x) => x.midi!);
      const deg = mel.map((m) => scaleRange(7, major, 43, 67).indexOf(m));
      for (let i = 1; i < deg.length; i++) {
        moves++;
        if (Math.abs(deg[i] - deg[i - 1]) <= 1) steps++;
      }
    }
    expect(steps / moves).toBeGreaterThan(0.55);
  });
});

describe('backing', () => {
  it('parses chord symbols', () => {
    expect(parseChordSymbol('Em')!.chord.id).toBe('min');
    expect(parseChordSymbol('A7')!.chord.id).toBe('7');
    expect(parseChordSymbol('F#m7')!.chord.id).toBe('m7');
    expect(parseChordSymbol('Bbmaj7')!.chord.id).toBe('maj7');
    expect(parseChordSymbol('D/F#')!.chord.id).toBe('maj');
    expect(parseChordSymbol('x')).toBeNull();
  });

  it('plays boom-chuck: bass root and fifth, chuck on 2 and 4', () => {
    const spans = progressionSpans(['G', 'C'], 4);
    const ev = boomChuck(spans, 4, 8, 0, 8);
    expect(ev.map((e) => e.kind)).toEqual(['bass', 'chuck', 'bass', 'chuck', 'bass', 'chuck', 'bass', 'chuck']);
    expect(ev[0].midis).toEqual([43]); // G2
    expect(ev[2].midis).toEqual([50]); // D3, the fifth
    expect(ev[4].midis).toEqual([48]); // C3
    expect(ev[1].midis.map((m) => m % 12).sort((a, b) => a - b)).toEqual([2, 7, 11]);
  });

  it('merges repeated chords and keeps the last chord to the end', () => {
    const spans = chordSpans([{ onset: 0, symbol: 'D' }, { onset: 4, symbol: 'D' }, { onset: 8, symbol: 'A7' }], 16);
    expect(spans.map((s) => [s.symbol, s.start, s.end])).toEqual([['D', 0, 8], ['A7', 8, 16]]);
  });
});

describe('pitch detection and grading', () => {
  it('detects guitar pitches from the synth', () => {
    const sr = 48000;
    for (const m of [40, 45, 52, 59, 64, 71, 76]) {
      const buf = renderString(sr, m, 0.4, seeded(m));
      const r = detectPitch(buf.slice(4800, 4800 + 2048), sr);
      expect(r?.midi).toBe(m);
      expect(Math.abs(r!.cents)).toBeLessThan(15);
    }
  });

  it('ignores silence and noise', () => {
    expect(detectPitch(new Float32Array(2048), 48000)).toBeNull();
    const rand = seeded(3);
    const noise = Float32Array.from({ length: 2048 }, () => (rand() * 2 - 1) * 0.3);
    expect(detectPitch(noise, 48000)).toBeNull();
  });

  it('finds picked notes and hammer-ons in a frame stream', () => {
    const frames = [
      { time: 0.0, rms: 0.001, midi: null },
      { time: 0.02, rms: 0.2, midi: 55 },
      { time: 0.04, rms: 0.18, midi: 55 },
      { time: 0.06, rms: 0.15, midi: 55 },
      { time: 0.08, rms: 0.14, midi: 57 }, // hammer-on: new pitch, no new attack
      { time: 0.1, rms: 0.13, midi: 57 },
      { time: 0.12, rms: 0.4, midi: 59 }, // picked
      { time: 0.14, rms: 0.35, midi: 59 },
    ];
    expect(segmentNotes(frames)).toEqual([{ time: 0.02, midi: 55 }, { time: 0.08, midi: 57 }, { time: 0.12, midi: 59 }]);
  });

  it('grades hits, octave slips, wrong notes and misses with timing', () => {
    const expected = [0, 0.5, 1, 1.5].map((time, i) => ({ time, midi: 60 + i }));
    const played = [
      { time: 0.02, midi: 60 },
      { time: 0.48, midi: 73 },
      { time: 1.03, midi: 65 },
    ];
    const g = grade(expected, played, 0.15);
    expect(g.notes.map((x) => x.verdict)).toEqual(['hit', 'octave', 'wrong', 'missed']);
    expect(g.notes[0].offsetMs).toBe(20);
    expect(g.accuracy).toBe(0.25);
    expect(median([30, 10, 20])).toBe(20);
  });
});

describe('grading a recording', () => {
  const sr = 48000;
  // Render a phrase as audio, optionally letting every string ring on.
  const perform = (notes: { time: number; midi: number; dur: number }[], ring: boolean, wrong = new Set<number>()) => {
    const total = Math.ceil((notes[notes.length - 1].time + 1.5) * sr);
    const buf = new Float32Array(total);
    const rand = seeded(9);
    notes.forEach((x, i) => {
      const s = renderString(sr, wrong.has(i) ? x.midi + 2 : x.midi, ring ? 1.2 : x.dur, rand);
      const off = Math.floor(x.time * sr);
      for (let k = 0; k < s.length && off + k < total; k++) buf[off + k] += s[k] * 0.5;
    });
    return buf;
  };
  const tune = parseAbc(TUNES.find((t) => t.id === 'red-haired-boy')!.abc);
  const tl = timeline(expandRepeats(splitParts(tune.measures)[0]).slice(0, 5), 4);
  const spb = 60 / 120;
  const expected = tl.notes.filter((x) => x.midi !== null).map((x) => ({ time: 0.4 + x.onset * spb, midi: x.midi! - 12, dur: x.dur * spb }));

  it('marks a clean performance as right and on time', () => {
    const g = gradeOnsets(expected, analyzeRecording(perform(expected, false), sr), 0.2);
    expect(g.accuracy).toBeGreaterThan(0.9);
    expect(g.meanAbsMs).toBeLessThan(25);
  });

  it('copes with strings ringing over each other', () => {
    expect(gradeOnsets(expected, analyzeRecording(perform(expected, true), sr), 0.2).accuracy).toBeGreaterThan(0.75);
  });

  it('catches wrong notes', () => {
    const wrong = new Set([2, 6, 10, 14]);
    const g = gradeOnsets(expected, analyzeRecording(perform(expected, false, wrong), sr), 0.2);
    wrong.forEach((i) => expect(g.notes[i].verdict).toBe('wrong'));
  });

  it('reports timing against the audio clock', () => {
    const late = expected.map((x) => ({ ...x, time: x.time + 0.03 }));
    const g = gradeOnsets(expected, analyzeRecording(perform(late, false), sr), 0.2);
    expect(g.meanMs).toBeGreaterThan(15);
    expect(g.meanMs).toBeLessThan(45);
  });
});
