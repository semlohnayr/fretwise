/** Marks whatever is sounding right now (a dot on the neck, a note in the tab) with the `now` class. */
let lit: Element[] = [];

export function markNow(selector: string | null): void {
  lit.forEach((e) => e.classList.remove('now'));
  lit = selector ? [...document.querySelectorAll(selector)] : [];
  lit.forEach((e) => e.classList.add('now'));
}

export const markPos = (pos: string): void => markNow(`.fretboard .dot[data-pos="${pos}"]`);
