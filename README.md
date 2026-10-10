# Fretwise

An interactive guitar and music theory workbench that runs in the browser. Three connected views share one root note, so you can pick a key on the circle, jump to its chords on the neck, and compare its modes without losing your place.

## Views

**Circle of fifths**
- Major keys on the outer ring, relative minors in the middle, diminished chords in the centre ring, key-signature counts around the edge.
- Selecting a key highlights its seven chords as a wedge and labels each with its Roman numeral.
- Key panel: key signature, relative and parallel keys, enharmonic respelling (F♯/G♭ and friends), the scale, triads or seventh chords, and common progressions spelled in the key.
- Expandable explanations: why fifths, reading key signatures, relative minors, finding chords, enharmonic keys, using the circle on guitar.

**Fretboard**
- Scale, Chord, Triads and Find-a-note modes.
- 13 scales (all seven modes, harmonic and melodic minor, pentatonics, minor and major blues) and 19 chord types up to ninths.
- Labels as intervals or note names. Every dot is coloured by interval function, using the same colours in every view.
- CAGED: show all five shapes as boxes or focus on one; in Chord mode the grip itself is ringed. Available in standard tuning for anything with a major or minor triad inside it.
- Triads: close voicings on any three adjacent strings, connected and coloured by inversion. Works in any tuning.
- Tunings: standard, half step down, drop D, double drop D, DADGAD, open G/D/E/C, drop C, or a custom tuning with 3 to 9 strings (handy for bass, 7-strings, mandolin-style setups).
- 12 to 24 frets; the neck scrolls horizontally on small screens.

**Modes**
- Parallel view: all seven modes on one root against a chromatic ruler, ordered brightest to darkest, so you can watch one note drop at a time.
- Relative view: the seven modes of one parent major key.
- Characteristic note outlined on every row; detail panel with feel, harmony, examples, the mode's chords and links to the fretboard and circle.

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
    keys.ts        Circle of fifths, key signatures, harmonisation, progressions
    fretboard.ts   Tunings, fret maths, CAGED shapes, triad voicings
  ui/              View rendering (plain DOM + SVG, no framework)
    circle.ts      Circle of fifths view
    fretboard.ts   Fretboard view
    modes.ts       Modes view
    controls.ts    Shared pickers and note chips
    dom.ts         Tiny element helpers
  state.ts         Shared app state and URL hash sync
  main.ts          Navigation and rendering
  styles.css
tests/
  theory.test.ts   Spelling, keys, harmonisation, CAGED and triad tests
```

The theory engine has no DOM dependencies, so it can be reused elsewhere (a CLI, a different UI) or extended with tests first.

## Ideas for next steps

- Audio playback with the Web Audio API (click a note or strum a chord).
- Left-handed (mirrored) fretboard.
- Scale-position (3-notes-per-string) patterns alongside CAGED.
- Chord voicing library and a capo calculator.
- Interval and note-finding ear and fretboard quizzes.

## License

MIT
