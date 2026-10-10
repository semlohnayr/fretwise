/**
 * Common bluegrass guitar licks, written in G. These are generic, widely
 * taught building blocks rather than transcriptions of any recording.
 * Slurs mark hammer-ons and pull-offs. They can be moved to any key.
 *
 * Like all guitar music (and the tunes), they are written an octave above
 * the pitch that sounds: "G," here is the open 3rd string.
 */

export interface LickEntry {
  id: string;
  name: string;
  /** When to use it. */
  use: string;
  abc: string;
  /** Explicit pick pattern (D/U for each picked note), when the lick is about a picking technique. */
  picks?: string;
}

const head = (title: string) => `X:1\nT:${title}\nM:4/4\nL:1/8\nK:G\n`;

export const LICKS: LickEntry[] = [
  {
    id: 'g-run',
    name: 'The G run',
    use: 'The signature bluegrass ending, made famous by Lester Flatt. Use it at the end of a vocal line or a break that lands on G. Hammer from the B♭ to the B.',
    abc: `${head('G run')}"G"d GED (^A,B,) G,2|`,
  },
  {
    id: 'walk-g-c',
    name: 'Bass walk up, I to IV',
    use: 'Connects the I chord to the IV chord (G to C in G) on the beats leading into the change.',
    abc: `${head('G to C walk')}"G"G,2 A,2 B,2 "C"C2|`,
  },
  {
    id: 'walk-c-g',
    name: 'Bass walk down, IV to I',
    use: 'The reverse: walks back down from the IV chord to the I (C to G in G).',
    abc: `${head('C to G walk')}"C"C2 B,2 A,2 "G"G,2|`,
  },
  {
    id: 'walk-g-d',
    name: 'Bass walk up, I to V',
    use: 'Walks from the I chord to the V (G to D in G); the raised 4th is a chromatic leading note into the V.',
    abc: `${head('G to D walk')}"G"G,2 A,2 B,2 ^C2|"D"D4 z4|`,
  },
  {
    id: 'crosspick-g-c',
    name: 'Crosspicking roll, I to IV',
    use: 'Three strings, one note each, in a repeating 3-3-2 grouping. Down-up-up keeps the pick moving smoothly across the strings and the notes ring together like a banjo roll.',
    abc: `${head('Crosspicking roll')}"G"GBg GBg GB|"C"Gce Gce Gc|`,
    picks: 'DUUDUUDU',
  },
  {
    id: 'blue-third',
    name: 'Blue third hammer-on',
    use: 'Hammer from the flat 3rd to the 3rd of the I chord (B♭ to B in G). A bluesy way into almost any phrase.',
    abc: `${head('Blue third')}"G"(^AB)d2 g2 B2|`,
  },
  {
    id: 'open-pull-offs',
    name: 'Open-string pull-offs',
    use: 'Pull off to open strings for a fluid, fast-sounding run in first position.',
    abc: `${head('Pull-offs')}"G"(dB) A(BA) G(AG)|E2 D2 G,4|`,
  },
  {
    id: 'pent-run-down',
    name: 'Major pentatonic run down',
    use: 'Two octaves of G major pentatonic falling back to the root: a strong way to finish a break.',
    abc: `${head('Pentatonic run')}"G"gedB AGED|B,A,G,E, G,4|`,
  },
  {
    id: 'tag-ending',
    name: 'Tag ending',
    use: 'A short phrase that closes a tune or a break on the root.',
    abc: `${head('Tag')}"G"BAGE DEGA|"D"B2A2 "G"G4|`,
  },
];
