/**
 * Practice session plans. Each step is timed and, where it makes sense,
 * opens the page and exercise it is about.
 */
import type { View, MelodyTab, QuizKind, FretMode, Pattern } from '../state';

export interface StepOpen {
  view: View;
  melodyTab?: MelodyTab;
  warmupId?: string;
  tuneId?: string;
  lickId?: string;
  quiz?: QuizKind;
  fretMode?: FretMode;
  scaleId?: string;
  chordId?: string;
  root?: string;
  pattern?: Pattern;
  npsPosition?: number;
  caged?: 'all' | 'C' | 'A' | 'G' | 'E' | 'D';
  modesView?: 'parallel' | 'relative';
  /** Melody page details: part (-1 = whole tune), two-bar phrase (-1 = all), starting fret, chord-changes key and progression. */
  melody?: { part?: number; phrase?: number; warmFret?: number; changesKey?: string; changesProg?: string };
}

export interface PlanStep {
  id: string;
  title: string;
  minutes: number;
  how: string;
  open?: StepOpen;
}

export interface Plan {
  id: string;
  name: string;
  summary: string;
  steps: PlanStep[];
}

const LOOSEN: PlanStep = {
  id: 'loosen',
  title: 'Loosen up',
  minutes: 2,
  how: 'Away from the guitar: roll your shoulders, open and close your hands slowly a few times, and gently shake out your wrists. Then hold the guitar and play a few soft open strings. Keep everything easy; stop anything that hurts.',
};

export const PLANS: Plan[] = [
  {
    id: 'quick-15',
    name: 'Quick 15',
    summary: 'A short daily session that touches technique, a lick and a tune. Good for busy days: fifteen focused minutes beat an unfocused hour.',
    steps: [
      { ...LOOSEN, minutes: 1 },
      { id: 'open', title: 'Open-string picking', minutes: 2, how: 'Even, relaxed down-up strokes. Listen for equal volume on both directions.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'open-strings' } },
      { id: 'spider', title: 'Spider, 1-2-3-4', minutes: 3, how: 'One finger per fret. Slow enough that every note is clean.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'spider-1234', melody: { warmFret: 1 } } },
      { id: 'scale', title: 'G major, three notes per string', minutes: 3, how: 'Up and down with the metronome. If it is clean three times running, go up 4 BPM.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'g-3nps' } },
      { id: 'lick', title: 'Lick of the day: the G run', minutes: 3, how: 'Loop it with the backing until it feels automatic, then try it in C and D.', open: { view: 'melody', melodyTab: 'licks', lickId: 'g-run' } },
      { id: 'tune', title: 'Play a tune start to finish', minutes: 3, how: 'Pick a comfortable tempo and do not stop for mistakes; keeping time matters more than every note.', open: { view: 'melody', melodyTab: 'tunes', tuneId: 'soldiers-joy', melody: { part: -1, phrase: -1 } } },
    ],
  },
  {
    id: 'balanced-30',
    name: 'Balanced 30',
    summary: 'Warm-ups, technique, repertoire, improvising and ear training in one half hour. A good default for most days.',
    steps: [
      LOOSEN,
      { id: 'spider', title: 'Spider, 1-3-2-4 at the 5th fret', minutes: 3, how: 'Higher up the neck the frets are closer, so this is gentler on the stretch. Keep the fingers you are not using hovering close.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'spider-1324', melody: { warmFret: 5 } } },
      { id: 'trills', title: 'Hammer-on and pull-off trills', minutes: 3, how: 'Only the first note on each string is picked. Aim for even volume.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'trills', melody: { warmFret: 5 } } },
      { id: 'cross', title: 'String crossing', minutes: 3, how: 'Strict alternate picking across two strings. Keep the motion small.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'string-cross' } },
      { id: 'scale', title: 'Scale with the speed trainer', minutes: 4, how: 'Open the metronome, switch on the speed trainer (for example 70 to 110, +4 every 2 bars) and play the scale until it reaches the top. If it falls apart, note the tempo and start below it next time.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'g-3nps' } },
      { id: 'tune', title: 'Salt Creek, A part, two bars at a time', minutes: 6, how: 'Loop each two-bar phrase until it is easy, then move to the next. Join phrases once both are solid.', open: { view: 'melody', melodyTab: 'tunes', tuneId: 'salt-creek', melody: { part: 0, phrase: 0 } } },
      { id: 'changes', title: 'Improvise over I–IV–V', minutes: 5, how: 'Over the backing, start each chord on one of its chord tones (the 3rd is the strongest), then fill in with scale notes.', open: { view: 'melody', melodyTab: 'changes', melody: { changesKey: 'G', changesProg: 'three' } } },
      { id: 'ear', title: 'Intervals by ear', minutes: 4, how: 'Start with the basic set. Sing the two notes back before answering.', open: { view: 'practice', quiz: 'ear-interval' } },
    ],
  },
  {
    id: 'speed-25',
    name: 'Speed builder',
    summary: 'Clean, relaxed speed for flatpicking. Every drill starts slow and climbs with the speed trainer; finish with a graded take to check accuracy at tempo.',
    steps: [
      LOOSEN,
      { id: 'open', title: 'Open-string picking', minutes: 3, how: 'Set the speed trainer from 80 to 140, +5 every 2 bars. Stay loose; tension is what stops speed.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'open-strings' } },
      { id: 'threes', title: 'Pentatonic in threes', minutes: 6, how: 'The groups of three move the picking accent around the beat. Ramp the tempo, and when it gets messy, drop 10 BPM and climb again.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'pent-threes' } },
      { id: 'crosspick', title: 'Crosspicking roll', minutes: 5, how: 'Down-up-up across three strings, letting the notes ring together. Use "As written" picking.', open: { view: 'melody', melodyTab: 'licks', lickId: 'crosspick-g-c' } },
      { id: 'spider', title: 'Spider at the 7th fret', minutes: 4, how: 'Short, fast bursts: one pass at a tempo slightly above comfortable, then one at a relaxed tempo.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'spider-1234', melody: { warmFret: 7 } } },
      { id: 'grade', title: 'Graded take: Red Haired Boy, first phrase', minutes: 5, how: 'Use "Grade my playing" at a tempo you can almost manage. Aim for every note right before pushing the tempo.', open: { view: 'melody', melodyTab: 'tunes', tuneId: 'red-haired-boy', melody: { part: 0, phrase: 0 } } },
    ],
  },
  {
    id: 'tune-40',
    name: 'Learn a tune',
    summary: 'A structured way into a new fiddle tune: hear it, learn it phrase by phrase, join it up, then improvise over its chords.',
    steps: [
      LOOSEN,
      { id: 'spider', title: 'Spider, 1-2-3-4', minutes: 3, how: 'A quick finger warm-up before the real work.', open: { view: 'melody', melodyTab: 'warmups', warmupId: 'spider-1234', melody: { warmFret: 1 } } },
      { id: 'listen', title: 'Hear it first', minutes: 5, how: 'Play the whole tune a few times and follow the tab without playing. Hum along on the second time through.', open: { view: 'melody', melodyTab: 'tunes', tuneId: 'red-haired-boy', melody: { part: -1, phrase: -1 } } },
      { id: 'a-part', title: 'A part, phrase by phrase', minutes: 10, how: 'Loop two bars at a time at a slow tempo. Move on only when a phrase is clean three times running.', open: { view: 'melody', melodyTab: 'tunes', tuneId: 'red-haired-boy', melody: { part: 0, phrase: 0 } } },
      { id: 'b-part', title: 'B part, phrase by phrase', minutes: 10, how: 'Same method. Notice which phrases the B part shares with the A part.', open: { view: 'melody', melodyTab: 'tunes', tuneId: 'red-haired-boy', melody: { part: 1, phrase: 0 } } },
      { id: 'together', title: 'Put it together', minutes: 5, how: 'Whole tune with the boom-chuck backing, slowly. Keep going through mistakes.', open: { view: 'melody', melodyTab: 'tunes', tuneId: 'red-haired-boy', melody: { part: -1, phrase: -1 } } },
      { id: 'improv', title: 'Improvise over its chords', minutes: 5, how: 'The tune lives on A, G and D. Play over this A Mixolydian loop and land on chord tones as the chords change.', open: { view: 'melody', melodyTab: 'changes', melody: { changesKey: 'A', changesProg: 'mixo' } } },
    ],
  },
  {
    id: 'neck-20',
    name: 'Know the neck',
    summary: 'No technique pressure: twenty minutes of fretboard knowledge and listening that makes everything else easier.',
    steps: [
      { id: 'notes', title: 'Find the note', minutes: 5, how: 'Naturals first. Say the note name out loud as you answer.', open: { view: 'practice', quiz: 'note' } },
      { id: 'intervals', title: 'Intervals on the neck', minutes: 5, how: 'Learn the shapes: a 5th is one string up and two frets over, an octave two strings up and two frets over. Add one fret whenever the shape crosses from the G string to the B string.', open: { view: 'practice', quiz: 'fret-interval' } },
      { id: 'caged', title: 'CAGED tour in a new key', minutes: 5, how: 'Pick a key you rarely use. Step through the five shapes and play each chord grip.', open: { view: 'fretboard', fretMode: 'chord', chordId: 'maj', root: 'Bb', pattern: 'caged', caged: 'all' } },
      { id: 'modes', title: 'Hear the modes', minutes: 5, how: 'Play each mode over its drone, brightest to darkest, and name the note that changes each time.', open: { view: 'modes', scaleId: 'mixolydian', modesView: 'parallel' } },
    ],
  },
];

export const planById = (id: string): Plan | undefined => PLANS.find((p) => p.id === id);

/** Short guidance shown on the Sessions page. */
export const PRACTICE_TIPS: { title: string; text: string }[] = [
  { title: 'Warm up gently', text: 'Start with slow, easy playing for a few minutes. Cold hands and fast playing are a bad combination; speed comes later in the session.' },
  { title: 'Accuracy before speed', text: 'Practice at a tempo where every note is clean. Go up 4–5 BPM only after three clean passes in a row, and drop back when it gets sloppy.' },
  { title: 'Stay relaxed', text: 'Tension is the main thing that limits speed. Check your shoulders, jaw and picking hand between passes and let them go loose.' },
  { title: 'Small chunks, many repetitions', text: 'Loop two bars until they are easy before adding more. Short loops give far more repetitions per minute than playing a whole tune.' },
  { title: 'End with music', text: 'Finish by playing something all the way through at a comfortable tempo, mistakes and all. It is the reason for the drills.' },
  { title: 'Little and often', text: 'Fifteen focused minutes every day builds more than one long session a week. The practice log below keeps track of your streak.' },
];
