import { type Interval, type Note, ROOT_CHOICES, noteName, pc, intervalLabel } from '../theory';
import { h } from './dom';

/** CSS class for an interval's function: deg-1 (root) ... deg-7. Extensions fold down (9 → 2). */
export function degreeClass(i: Interval): string {
  return `deg-${((i.degree - 1) % 7) + 1}`;
}

/** A row of twelve root buttons. Enharmonic roots keep the spelling already chosen. */
export function rootPicker(current: Note, onPick: (n: Note) => void, label = 'Root'): HTMLElement {
  return h(
    'div',
    { class: 'field' },
    h('span', {}, label),
    h(
      'div',
      { class: 'roots', role: 'radiogroup', 'aria-label': label },
      ...ROOT_CHOICES.map((r) => {
        const on = pc(r) === pc(current);
        const shown = on ? current : r;
        return h(
          'button',
          { type: 'button', role: 'radio', 'aria-checked': String(on), class: on ? 'on' : '', onclick: () => onPick(r) },
          noteName(shown),
        );
      }),
    ),
  );
}

/** Notes with their interval chips, e.g. for a scale or chord. */
export function noteRow(notes: Note[], intervals: Interval[]): HTMLElement {
  return h(
    'ol',
    { class: 'note-row' },
    ...notes.map((x, i) =>
      h(
        'li',
        { class: degreeClass(intervals[i]) },
        h('b', {}, noteName(x)),
        h('small', {}, intervalLabel(intervals[i])),
      ),
    ),
  );
}

/** A button that plays something; shows a speaker-style triangle before the label. */
export function playButton(label: string, onPlay: () => void, extraClass = ''): HTMLButtonElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 12 12');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/>';
  // preventDefault/stopPropagation: a play button may sit inside a <summary> without toggling it.
  const btn = h('button', {
    type: 'button',
    class: `play ${extraClass}`,
    onclick: (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onPlay();
    },
  }, icon, label);
  if (!label) btn.setAttribute('aria-label', 'Play');
  return btn;
}
