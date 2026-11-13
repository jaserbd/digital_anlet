import { useState } from 'react';
import { useLocation } from 'react-router-dom';

// Collapsible sections (ADMIN_DASHBOARD_PLAN.md): open by default; what someone collapses is
// remembered per page + section in this browser only. Storage can be unavailable (private
// windows, blocked site data) — then sections simply start open.
const PREFIX = 'anlet.collapsed:';

function readCollapsed(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(key: string, collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(PREFIX + key, '1');
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Not remembered — fine.
  }
}

/** `[open, toggle]` for a section identified by `id` on the current page (null = not remembered). */
export function useRememberedOpen(id: string | null): [boolean, () => void] {
  const { pathname } = useLocation();
  const key = id === null ? null : `${pathname}#${id}`;
  const [open, setOpen] = useState(() => (key ? !readCollapsed(key) : true));
  const toggle = () =>
    setOpen((was) => {
      if (key) writeCollapsed(key, was);
      return !was;
    });
  return [open, toggle];
}
