# Fretwise

An interactive guitar and music theory workbench that runs in the browser. Its views share one root note, so you can pick a key on the circle, jump to its chords on the neck, and compare its modes without losing your place.

## Views

**Circle of fifths**
- Major keys on the outer ring, relative minors in the middle, diminished chords in the center ring, key-signature counts around the edge.
- Selecting a key highlights its seven chords as a wedge and labels each with its Roman numeral.
- Key panel: key signature, relative and parallel keys, enharmonic respelling (F♯/G♭ and friends), the scale, triads or seventh chords, and common progressions spelled in the key.
- Expandable explanations: why fifths, reading key signatures, relative minors, finding chords, enharmonic keys, using the circle on guitar.

**Fretboard**
- Scale, Chord, Triads and Find-a-note modes.
- 13 scales (all seven modes, harmonic and melodic minor, pentatonics, minor and major blues) and 19 chord types up to ninths.
- Patterns: CAGED boxes, or seven three-notes-per-string positions for any seven-note scale (in any tuning).
- Voicing library: every playable root-position grip for the chosen chord and tuning, drawn as chord diagrams. Select one to light it up on the neck and hear it.
- Labels as intervals or note names. Every dot is colored by interval function, using the same colors in every view.
- CAGED: show all five shapes as boxes or focus on one; in Chord mode the grip itself is ringed. Available in standard tuning for anything with a major or minor triad inside it.
- CAGED chords: the five CAGED shapes (where they are in common use) for major, minor, 7, maj7, m7, 6, m6, sus2, sus4, add9, 9, m7♭5 and dim7 in any key, as chord diagrams in neck order and on the neck. Tap a shape to hear it and see it in place; the CAGED overlay in Chord mode uses the same shapes.
- Triads: close voicings on any three adjacent strings, connected and colored by inversion. Works in any tuning.
- Tunings: standard, half step down, drop D, double drop D, DADGAD, open G/D/E/C, drop C, or a custom tuning with 3 to 9 strings (handy for bass, 7-strings, mandolin-style setups).
- 12 to 24 frets; the neck scrolls horizontally on small screens.

**Sound**
- A built-in plucked-string synth (Karplus–Strong, no samples). Select any note on the neck to hear it; play scales, positions, chords, triads, every chord in a key, progressions, and modes over a drone.
- The Sound button in the header mutes everything and remembers your choice.

**Metronome**
- Opens from the header and stays docked at the bottom of every page, so it keeps time while you look at the neck.
- 30–300 BPM, tap tempo, 2–7 beats per bar, quarter, eighth, triplet or sixteenth clicks, and an accented downbeat. Space starts and stops it.
- Speed trainer: start at one tempo and climb a set number of BPM every few bars until you reach a target, then hold.
- Play-along: pick a 3-per-string position or a single CAGED shape for a scale on the Fretboard page and the metronome plays it up and back down, one note per click, lighting each note on the neck as it sounds.
- Clicks are scheduled ahead on the audio clock, so timing stays steady even when the page is busy.

**Modes**
- Parallel view: all seven modes on one root against a chromatic ruler, ordered brightest to darkest, so you can watch one note drop at a time.
- Relative view: the seven modes of one parent major key.
- Characteristic note outlined on every row; detail panel with feel, harmony, examples, the mode's chords and links to the fretboard and circle.

**Melody**
- Fiddle tunes: Soldier's Joy, Old Joe Clark, Salt Creek, Red Haired Boy and Billy in the Lowground, each linked to the published transcription it is based on. Practice the whole tune, one part, or a two-bar phrase on a loop, with or without the usual capo.
- Add your own tunes by pasting ABC notation (the format most fiddle-tune sites offer); they are saved in your browser.
- Licks: the G run, bass walks, a crosspicking roll, hammer-on and pull-off licks, a pentatonic run and a tag ending, in any key.
- Random melody: new singable melodies in any key and scale, at your choice of length and rhythm.
- Over the changes: a boom-chuck backing for common progressions (including twelve-bar blues and an eight-bar bluegrass form) while the neck shows the current chord's tones.
- Everything is shown as proportionally spaced tab with pick strokes (alternate, economy, or the lick's own pattern), hammer-ons and pull-offs, and chord symbols, plus the notes on the neck. The note being played lights up in both.
- Playback runs through the metronome, so the count-in, click and speed trainer all apply, with an optional boom-chuck backing from the tune's chords.
- Grade my playing: play the phrase into your microphone after a count-in and get each note marked right, wrong octave, wrong note or not heard, with your average timing (rushing or dragging). A one-time calibration measures your microphone's delay. Grading listens for each pick attack and the new pitch at that moment, so strings ringing over each other do not throw it off.

**Practice** (practice plans)
- Five practice plans (Quick 15, Balanced 30, Speed builder, Learn a tune, Know the neck), each a list of timed steps with a short how-to.
- Start a plan and a bar under the header counts down each step, plays a soft chime when its time is up, and takes you straight to the exercise. Pause, skip ahead or end at any time; adjust step lengths before you start.
- A practice log in your browser tracks minutes per day, the last seven days and your streak.
- Practice tips: warming up, accuracy before speed, staying relaxed, short loops, ending with music.

**Warm-ups** (on the Melody page): open-string picking, string crossing, two spider drills (1-2-3-4 and 1-3-2-4) on any fret, hammer-on and pull-off trills, a three-notes-per-string G major scale and G pentatonic in threes. Fingering is fixed, the neck shows which finger plays each fret, and everything works with the speed trainer and grading.

**Capo**
- Pick the key you need to sound in and see which open-chord keys (G, C, D, A, E; Em, Am, Dm) get you there and on which fret.
- Translate any shape key and capo position chord by chord into the sounding key, with playback at concert pitch.

**Quizzes**
- Find the note: name a highlighted fret (naturals or all 12, any tuning).
- Intervals on the neck: name the distance between two marked notes.
- Intervals by ear and chords by ear: melodic or harmonic intervals; triad or seventh-chord qualities.
- Score, streak and a best streak that is saved in your browser.

Links are shareable: the URL hash carries the view, root, scale, chord and fretboard mode (for example `#fretboard?root=A&scale=dorian&mode=scale`).

The navigation is split into **Learn** (Circle, Fretboard, Modes, Capo) and **Play** (Melody, Quizzes, Practice). Each page leads with its main controls and the thing you look at; secondary settings (neck tuning and labels, playback and picking options) and longer explanations sit in panels you open when you need them.

## Correct spelling

The theory engine treats a note as a letter plus an accidental rather than a bare pitch, so notes are spelled the way the key needs them: F♯ major contains E♯, G♭ major contains C♭, C°7 is C E♭ G♭ B𝄫, and A Dorian's chords come out as Am, Bm, C, D, Em, F♯°, G.

## Getting started

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # theory engine tests (Vitest)
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

## Deploying to GitHub Pages

1. Push the repository to GitHub with `main` as the default branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Every push to `main` runs the tests, builds, and deploys. Pull requests run the tests and build only.

`vite.config.ts` uses a relative base path, so the site works at `https://<user>.github.io/<repo>/` without editing anything.

After your first `npm install`, commit `package-lock.json` and switch the workflow step to `npm ci` (and add `cache: npm` to `setup-node`) for faster, reproducible builds.

## Project layout

```
src/
  theory/          Framework-free music theory engine
    notes.ts       Letter + accidental note model, parsing, naming
    intervals.ts   Intervals with diatonic degree, transposition
    scales.ts      Scales, modes and mode descriptions
    chords.ts      Chord formulas and chord identification
    keys.ts        Circle of fifths, key signatures, harmonization, progressions
    fretboard.ts   Tunings, fret maths, absolute pitch, CAGED, 3NPS, triad voicings
    voicings.ts    Playable chord voicing generator
    capo.ts        Capo calculator
    quiz.ts        Practice question generators (seedable)
    tempo.ts       Tempo ramp, tap tempo and click-pattern helpers
    abc.ts         ABC notation parser, repeats, parts and timelines
    tab.ts         Automatic fingering and pick direction
    melodygen.ts   Random melody generator
    backing.ts     Chord symbols and boom-chuck backing
    pitch.ts       Pitch detection, recording analysis and grading
  ui/              View rendering (plain DOM + SVG, no framework)
    circle.ts      Circle of fifths view
    fretboard.ts   Fretboard view
    modes.ts       Modes view
    capo.ts        Capo view
    practice.ts    Practice quizzes
    metronome.ts   Metronome dock
    melody.ts      Melody page
    tab.ts         Tab renderer
    highlight.ts   Marks the note that is sounding
    sessions.ts    Sessions page
    sessionbar.ts  Session timer bar
    controls.ts    Shared pickers and note chips
    dom.ts         Tiny element helpers
  audio.ts         Plucked-string synth and metronome click (Web Audio)
  metronome.ts     Look-ahead scheduler: click, speed trainer, play-along tracks
  mic.ts           Microphone input for grading
  content/         Tunes and licks (ABC), warm-ups and practice plans
  session.ts       Practice-session runner (timer, steps, log)
  sessionlog.ts    Practice log statistics
  state.ts         Shared app state and URL hash sync
  main.ts          Navigation and rendering
  styles.css
tests/
  theory.test.ts   Spelling, keys, harmonization, CAGED and triad tests
  features.test.ts String pitches, 3NPS, voicings, capo, quizzes, synth tuning
  tempo.test.ts    Tempo ramp, tap tempo, click accents
  melody.test.ts   ABC parsing, bundled tunes, fingering, picking, melodies, backing, grading
  sessions.test.ts Practice log, plans and warm-ups
```

The theory engine has no DOM dependencies, so it can be reused elsewhere (a CLI, a different UI) or extended with tests first.

## Ideas for next steps

- Left-handed (mirrored) fretboard.
- Inversions and drop voicings in the voicing library.
- Call-and-response and scale-degree dictation ear training.
- More tunes, and B-part endings and variations.

## License

MIT
