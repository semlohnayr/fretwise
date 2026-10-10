/**
 * Traditional fiddle tunes, written in ABC. The melodies are in the public
 * domain; each version below is a simplified setting based on the published
 * transcription linked in `source` (ornaments and slides removed, chords added
 * where the source had none). Different players play these differently, so
 * treat them as one good version, not the only one.
 */

export interface TuneEntry {
  id: string;
  title: string;
  /** How it is usually played on guitar. */
  note: string;
  /** Capo fret commonly used, if any, so open G shapes can be used. */
  capo?: number;
  abc: string;
  source: { label: string; url: string };
}

export const TUNES: TuneEntry[] = [
  {
    id: 'soldiers-joy',
    title: "Soldier's Joy",
    note: 'One of the oldest and most-played fiddle tunes. Played in D in open position; the A part lives around the open D and G strings.',
    abc: `X:1
T:Soldier's Joy
M:4/4
L:1/8
K:D
FG|"D"AFDF AFDF|A2d2 "G"d2cB|"D"AFDF AFDF|"E7"G2E2 "A7"E2FG|
"D"AFDF AFDF|A2d2 "G"d2e2|"D"fafd "A7"egec|"D"d2d2 d2:|
|:de|"D"f2f2 fagf|"A7"e2e2 egfe|"D"f2f2 fagf|"E7"edcB "A"A2de|
"D"f2f2 fagf|"A7"e2e2 egfe|"D"fafd "A7"egec|"D"d2d2 d2:|`,
    source: { label: 'Session tune collection (dottes)', url: 'https://hg.lunch.org.uk/dottes/annotate/build-default-158/Session/SoldiersJoy.abc' },
  },
  {
    id: 'old-joe-clark',
    title: 'Old Joe Clark',
    note: 'A Mixolydian: an A major scale with a G natural, and a G chord in place of E. Short parts, each played twice.',
    capo: 2,
    abc: `X:1
T:Old Joe Clark
M:4/4
L:1/8
K:Amix
|:"A"efgf edc2|efgf e2e2|efgf edc2|"G"AcBG "A"A2A2:|
|:"A"A2A2 edc2|AA/A/GA E2E2|A2A2 edc2|"G"AcBG "A"A2A2:|`,
    source: { label: 'MOTley Morris (MIT)', url: 'https://www.mit.edu/~jcb/MOTley/dances/old-joe-clark-tune.shtml' },
  },
  {
    id: 'salt-creek',
    title: 'Salt Creek',
    note: 'A bluegrass jam favorite in A Mixolydian. Guitarists usually capo 2 and play it with G-position shapes.',
    capo: 2,
    abc: `X:1
T:Salt Creek
M:4/4
L:1/8
K:Amix
"A"A2AA A2AB|cABc "D"d2A2|"G"BA=GA BA=GA|BA=GF "E"E2E2|
"A"A2AA A2AB|cABc "D"d2ed|"G"cefg afed|"E"cABc "A"A4:|
|:"A"a2aa a2ab|c'ebe abae|"G"=ga=gf ef=ga|=gfed cBA2|
"A"a2aa a2ab|c'ebe abae|"G"=ga=gf efed|"E"cABc "A"A4:|`,
    source: { label: 'Traditional Tune Archive (MandoZine setting)', url: 'https://ttadev.org/wiki/Annotation:Salt_Creek' },
  },
  {
    id: 'red-haired-boy',
    title: 'Red Haired Boy',
    note: 'An Irish hornpipe (The Little Beggarman) that became a bluegrass standard. Played in A with a G natural.',
    capo: 2,
    abc: `X:1
T:Red Haired Boy
M:4/4
L:1/8
K:Amix
AG|"A"EAAG ABcd|efec "D"d2cd|"A"edcB ABcA|"G"BGEF G2ED|
"A"EAAG ABcd|efec "D"d2cd|"A"eaab "G"aged|"A"c2A2 A2:|
|:ef|"G"gfga g2ef|gfec "D"d2cd|"A"edcB ABcA|"G"BGEF G2ED|
"A"EAAG ABcd|efec "D"d2cd|"A"eaab "G"aged|"A"c2A2 A2:|`,
    source: { label: "Traditional Tune Archive (O'Neill, 1903)", url: 'https://tunearch.org/wiki/Red_Haired_Boy' },
  },
  {
    id: 'billy-in-the-lowground',
    title: 'Billy in the Lowground',
    note: 'A C-major tune that starts low on the A and low E strings and climbs. The source gives no chords, so there is no backing for this one.',
    abc: `X:1
T:Billy in the Lowground
M:4/4
L:1/8
K:C
CA,|:G,A,CD EGAB|cBcd cGAG|EA2c AGEG|Adcd edc2|
G,A,CD EGAB|cBcd cGAG|EA2B AGEG|1cGAG EDCA,:|2cGAG EDC2||
|:g3a gecd|egag edcd|ea2a abag|egag edcd|
eg2a gedg|egag edcd|e2ed cAGA|cGAG EDC2:|`,
    source: { label: 'Traditional Tune Archive (Leonard Rutherford, 1928)', url: 'https://tunearch.org/wiki/Billy_in_the_Lowground_(1)' },
  },
];
