// Small DOM helpers: finding elements, the toast, busy buttons, and keeping what a player typed across re-renders.

export function $<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} is missing`);
  return el;
}
export const $maybe = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** One message at a time, read out politely; errors stay a little longer. */
export function toast(message: string, tone: 'info' | 'error' = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.dataset.tone = tone;
  el.dataset.shown = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.dataset.shown = 'false'), tone === 'error' ? 6000 : 3500);
}

/** Runs `work` with the button marked busy, so a slow call can't be clicked twice. */
export async function busy<T>(button: HTMLElement | null, work: () => Promise<T>): Promise<T> {
  if (button) { button.setAttribute('aria-busy', 'true'); button.setAttribute('disabled', ''); }
  try {
    return await work();
  } finally {
    if (button) { button.removeAttribute('aria-busy'); button.removeAttribute('disabled'); }
  }
}

/** Re-renders `root` without losing what the player was typing: values, checks and focus come back by element id. */
export function keepForms(root: HTMLElement, render: () => void) {
  const saved = new Map<string, { value: string; checked: boolean }>();
  root.querySelectorAll<HTMLInputElement>('input[id], select[id], textarea[id]').forEach((el) => saved.set(el.id, { value: el.value, checked: el.checked }));
  const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement.id : '';
  render();
  saved.forEach((v, id) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el || el.type === 'password' && !v.value) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = v.checked; else el.value = v.value;
  });
  if (active) document.getElementById(active)?.focus();
}
