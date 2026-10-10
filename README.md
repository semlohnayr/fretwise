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
- Triads: close voicings on any three adjacent strings, connected and colored by inversion. Works in any tuning.
- Tunings: standard, half step down, drop D, double drop D, DADGAD, open G/D/E/C, drop C, or a custom tuning with 3 to 9 strings (handy for bass, 7-strings, mandolin-style setups).
- 12 to 24 frets; the neck scrolls horizontally on small screens.

**Sound**
- A built-in plucked-string synth (Karplus–Strong, no samples). Select any note on the neck to hear it; play scales, positions, chords, triads, every chord in a key, progressions, and modes over a drone.
- The Sound button in the header mutes everything and remembers your choice.

**Modes**
- Parallel view: all seven modes on one root against a chromatic ruler, ordered brightest to darkest, so you can watch one note drop at a time.
- Relative view: the seven modes of one parent major key.
- Characteristic note outlined on every row; detail panel with feel, harmony, examples, the mode's chords and links to the fretboard and circle.

**Capo**
- Pick the key you need to sound in and see which open-chord keys (G, C, D, A, E; Em, Am, Dm) get you there and on which fret.
- Translate any shape key and capo position chord by chord into the sounding key, with playback at concert pitch.

**Practice**
- Find the note: name a highlighted fret (naturals or all 12, any tuning).
- Intervals on the neck: name the distance between two marked notes.
- Intervals by ear and chords by ear: melodic or harmonic intervals; triad or seventh-chord qualities.
- Score, streak and a best streak that is saved in your browser.

Links are shareable: the URL hash carries the view, root, scale, chord and fretboard mode (for example `#fretboard?root=A&scale=dorian&mode=scale`).

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
  ui/              View rendering (plain DOM + SVG, no framework)
    circle.ts      Circle of fifths view
    fretboard.ts   Fretboard view
    modes.ts       Modes view
    capo.ts        Capo view
    practice.ts    Practice quizzes
    controls.ts    Shared pickers and note chips
    dom.ts         Tiny element helpers
  audio.ts         Plucked-string synth (Web Audio)
  state.ts         Shared app state and URL hash sync
  main.ts          Navigation and rendering
  styles.css
tests/
  theory.test.ts   Spelling, keys, harmonization, CAGED and triad tests
  features.test.ts String pitches, 3NPS, voicings, capo, quizzes, synth tuning
```

The theory engine has no DOM dependencies, so it can be reused elsewhere (a CLI, a different UI) or extended with tests first.

## Ideas for next steps

- Left-handed (mirrored) fretboard.
- Inversions and drop voicings in the voicing library.
- A metronome and tempo ramp for scale practice.

## License

MIT
