import { describe, it, expect } from 'vitest';
import {
  n, noteName, pc, transpose, formula, intervalLabel,
  scaleById, scaleNotes, parentMajor, chordById, chordNotes, identifyChord,
  CIRCLE, keySignature, harmonize, relativeMinor, progressionChords, MAJOR_PROGRESSIONS,
  TUNINGS, isStandard, cagedShapes, triadVoicings, fretPc, parseTuning,
} from '../src/theory';

const names = (xs: { letter: number; acc: number }[]) => xs.map((x) => noteName(x, true)).join(' ');

describe('note spelling', () => {
  it('parses and names notes', () => {
    expect(noteName(n('F#'))).toBe('F♯');
    expect(noteName(n('Bb'), true)).toBe('Bb');
    expect(pc(n('Cb'))).toBe(11);
    expect(pc(n('B#'))).toBe(0);
  });

  it('transposes by letter, not just semitones', () => {
    expect(noteName(transpose(n('C'), formula('#4')[0]), true)).toBe('F#');
    expect(noteName(transpose(n('C'), formula('b5')[0]), true)).toBe('Gb');
    expect(noteName(transpose(n('E'), formula('b3')[0]), true)).toBe('G');
  });

  it('labels intervals relative to major', () => {
    expect(formula('1 b3 #4 bb7').map(intervalLabel)).toEqual(['1', '♭3', '♯4', '𝄫7']);
  });
});

describe('scales', () => {
  it('spells every major key with seven distinct letters', () => {
    for (const slot of CIRCLE) {
      const notes = scaleNotes(slot.major, scaleById('ionian'));
      expect(new Set(notes.map((x) => x.letter)).size).toBe(7);
    }
  });

  it('spells F# major with E#, and Gb major with Cb', () => {
    expect(names(scaleNotes(n('F#'), scaleById('ionian')))).toBe('F# G# A# B C# D# E#');
    expect(names(scaleNotes(n('Gb'), scaleById('ionian')))).toBe('Gb Ab Bb Cb Db Eb F');
  });

  it('builds modes', () => {
    expect(names(scaleNotes(n('D'), scaleById('dorian')))).toBe('D E F G A B C');
    expect(names(scaleNotes(n('F'), scaleById('lydian')))).toBe('F G A B C D E');
    expect(names(scaleNotes(n('A'), scaleById('minor-pentatonic')))).toBe('A C D E G');
    expect(names(scaleNotes(n('A'), scaleById('blues')))).toBe('A C D Eb E G');
  });

  it('finds the parent major of a mode', () => {
    expect(noteName(parentMajor(n('D'), 'dorian'), true)).toBe('C');
    expect(noteName(parentMajor(n('E'), 'phrygian'), true)).toBe('C');
    expect(noteName(parentMajor(n('A'), 'mixolydian'), true)).toBe('D');
    expect(noteName(parentMajor(n('F#'), 'locrian'), true)).toBe('G');
    expect(noteName(parentMajor(n('G'), 'ionian'), true)).toBe('G');
  });
});

describe('chords', () => {
  it('spells chords with correct letters', () => {
    expect(names(chordNotes(n('C'), chordById('dim7')))).toBe('C Eb Gb Bbb');
    expect(names(chordNotes(n('B'), chordById('m7b5')))).toBe('B D F A');
    expect(names(chordNotes(n('E'), chordById('9')))).toBe('E G# B D F#');
  });

  it('identifies stacked thirds', () => {
    expect(identifyChord(n('G'), [n('G'), n('B'), n('D'), n('F')])?.id).toBe('7');
  });
});

describe('keys and the circle', () => {
  it('has correct key signatures around the circle', () => {
    const counts = CIRCLE.map((s) => {
      const k = keySignature(s.major);
      return k.sharps ? `${k.sharps}#` : k.flats ? `${k.flats}b` : '0';
    });
    expect(counts).toEqual(['0', '1#', '2#', '3#', '4#', '5#', '6#', '5b', '4b', '3b', '2b', '1b']);
    expect(keySignature(n('Eb')).accidentals).toEqual(['B♭', 'E♭', 'A♭']);
  });

  it('pairs relative minors', () => {
    expect(CIRCLE.map((s) => noteName(s.minor, true))).toEqual(
      ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D'],
    );
    expect(noteName(relativeMinor(n('Eb')), true)).toBe('C');
  });

  it('harmonizes the major scale', () => {
    const triads = harmonize(n('C'), scaleById('ionian'));
    expect(triads.map((c) => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(triads.map((c) => c.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
    const sevenths = harmonize(n('C'), scaleById('ionian'), true);
    expect(sevenths.map((c) => c.roman)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
  });

  it('harmonizes modes', () => {
    expect(harmonize(n('A'), scaleById('dorian')).map((c) => c.symbol)).toEqual(['Am', 'Bm', 'C', 'D', 'Em', 'F♯°', 'G']);
  });

  it('uses flat numerals for minor keys and borrowed chords', () => {
    expect(harmonize(n('A'), scaleById('aeolian')).map((c) => c.roman)).toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
    const mixo = progressionChords(n('G'), 'ionian', MAJOR_PROGRESSIONS.find((p) => p.name === 'Mixolydian rock')!);
    expect(mixo.map((c) => c.symbol)).toEqual(['G', 'F', 'C', 'G']);
    expect(mixo.map((c) => c.roman)).toEqual(['I', '♭VII', 'IV', 'I']);
  });
});

describe('fretboard', () => {
  const std = TUNINGS[0];

  it('computes fret pitches', () => {
    expect(fretPc(std, 0, 5)).toBe(9); // A on low E
    expect(fretPc(std, 4, 1)).toBe(0); // C on B string
    expect(isStandard(std)).toBe(true);
    expect(isStandard(TUNINGS.find((x) => x.id === 'drop-d')!)).toBe(false);
  });

  it('places the five CAGED shapes for C major in order', () => {
    const shapes = cagedShapes(n('C'), 'major', 15);
    expect(shapes.slice(0, 5).map((s) => s.name)).toEqual(['C', 'A', 'G', 'E', 'D']);
    expect(shapes[0].frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(shapes[1].frets).toEqual([null, 3, 5, 5, 5, 3]);
    expect(shapes[3].frets).toEqual([8, 10, 10, 9, 8, 8]);
  });

  it('only uses chord tones in every CAGED shape', () => {
    for (const q of ['major', 'minor'] as const) {
      for (const root of ['C', 'F#', 'Bb', 'E', 'G']) {
        const tones = new Set(chordNotes(n(root), chordById(q === 'major' ? 'maj' : 'min')).map(pc));
        for (const shape of cagedShapes(n(root), q, 22)) {
          shape.frets.forEach((f, s) => {
            if (f !== null) expect(tones.has(fretPc(std, s, f))).toBe(true);
          });
          expect(shape.minFret).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('finds every triad inversion on a string set', () => {
    const triad = chordNotes(n('G'), chordById('maj')).map(pc);
    const v = triadVoicings(std, triad, [3, 4, 5], 15);
    expect(new Set(v.map((x) => x.inversion))).toEqual(new Set([0, 1, 2]));
    for (const x of v) expect(new Set(x.tones).size).toBe(3);
  });

  it('parses custom tunings', () => {
    expect(parseTuning('E A D G').strings.length).toBe(4);
    expect(() => parseTuning('E A')).toThrow();
  });
});
