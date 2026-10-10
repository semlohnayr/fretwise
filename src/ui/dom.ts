type Attrs = Record<string, string | number | boolean | undefined | null | EventListener>;
type Child = Node | string | number | null | undefined | false;

function apply(el: Element, attrs: Attrs, children: Child[]): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Create an HTML element. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs, children as Child[]);
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';

/** Create an SVG element. */
export function s(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): SVGElement {
  const el = document.createElementNS(SVGNS, tag) as SVGElement;
  apply(el, attrs, children as Child[]);
  return el;
}

/** Make an SVG element behave like a button for mouse and keyboard. */
export function clickable<T extends Element>(el: T, label: string, onActivate: () => void): T {
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', label);
  el.addEventListener('click', onActivate);
  el.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      onActivate();
    }
  });
  return el;
}

export function select<T extends string>(
  label: string,
  value: T,
  options: { value: T; label: string; group?: string }[],
  onChange: (v: T) => void,
): HTMLLabelElement {
  const sel = h('select', { onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value as T) });
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const o of options) {
    const opt = h('option', { value: o.value, selected: o.value === value }, o.label);
    if (o.group) {
      if (!groups.has(o.group)) {
        const g = h('optgroup', { label: o.group });
        groups.set(o.group, g);
        sel.append(g);
      }
      groups.get(o.group)!.append(opt);
    } else sel.append(opt);
  }
  return h('label', { class: 'field' }, h('span', {}, label), sel);
}

export function segmented<T extends string>(
  label: string,
  value: T,
  options: { value: T; label: string; disabled?: boolean; title?: string }[],
  onChange: (v: T) => void,
): HTMLElement {
  return h(
    'div',
    { class: 'field' },
    h('span', {}, label),
    h(
      'div',
      { class: 'segmented', role: 'radiogroup', 'aria-label': label },
      ...options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(o.value === value),
            class: o.value === value ? 'on' : '',
            disabled: o.disabled,
            title: o.title,
            onclick: () => onChange(o.value),
          },
          o.label,
        ),
      ),
    ),
  );
}
