import { useEffect, useState, type ReactNode } from 'react';

// Wraps a table in a native <details>/<summary> disclosure — the app's existing collapsible
// convention (see QuestionCard.tsx's Guideline sections) — so a long list (e.g. ~196
// countries) doesn't force scrolling past it to reach the rest of the page. Closed by
// default; the row count in the summary label lets the admin know what's behind the click
// without opening it.
export function CollapsibleTable({
  label,
  count,
  children,
  forceOpen,
}: {
  label: string;
  count: number;
  children: ReactNode;
  // Opens it (e.g. while a search narrows the content); turning it off again leaves it as the
  // user last had it rather than collapsing it.
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem' }}>
        {label} ({count})
      </summary>
      {children}
    </details>
  );
}
