// Generic Enter-to-advance behavior for multi-field forms: pressing Enter in an
// <input> or <select> moves focus to the next focusable field within the same
// container, in DOM order — so it stays correct as fields are added/removed,
// without wiring refs onto every individual field. <textarea> keeps normal
// Enter-for-newline behavior. Pressing Enter in the container's last field
// runs onLastField (if given) instead — used to jump to the next tab.
const FOCUSABLE_SELECTOR = 'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

export const handleContainerEnter = (e, onLastField) => {
  if (e.key !== 'Enter') return;
  const target = e.target;
  if (target.tagName === 'TEXTAREA') return;
  const container = e.currentTarget;
  const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  const idx = focusables.indexOf(target);
  if (idx === -1) return;
  e.preventDefault();
  if (idx < focusables.length - 1) {
    const next = focusables[idx + 1];
    next.focus();
    if (next.select) next.select();
  } else if (onLastField) {
    onLastField();
  }
};

export const focusFirstField = (container) => {
  if (!container) return;
  const first = container.querySelector(FOCUSABLE_SELECTOR);
  if (first) { first.focus(); if (first.select) first.select(); }
};
