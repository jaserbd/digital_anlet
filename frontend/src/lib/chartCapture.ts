import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import html2canvas from 'html2canvas';

export interface CapturedChartImage {
  dataUrl: string;
  width: number;
  height: number;
}

// A plain timer rather than requestAnimationFrame — rAF callbacks are heavily throttled (or
// paused entirely) by the browser when the tab isn't the actively-painted foreground tab,
// which would stall report generation if a user switches away mid-download. A short timer
// still reliably lets React commit and Recharts' ResponsiveContainer lay out before capture.
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

// Renders `node` (a chart component, e.g. <ScoreBarChart .../>) off-screen at a fixed pixel
// size, snapshots it with html2canvas, and returns a PNG data URL — used by pdfSections.ts to
// embed real chart images in the PDF report (jsPDF can't render Recharts' SVG output
// natively). The container needs an explicit width/height (not display:none, which would
// give Recharts' ResponsiveContainer a zero-size box to measure) but sits far off-screen so
// nothing flashes on screen.
export async function captureChartImage(node: ReactNode, width: number, height: number): Promise<CapturedChartImage> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.background = '#ffffff';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(node);
  // One tick for React to commit, one more for Recharts' ResizeObserver-driven
  // ResponsiveContainer to lay out and paint the SVG before we snapshot it.
  await nextTick();
  await nextTick();

  try {
    // foreignObjectRendering lets the browser paint the (pure inline-SVG) chart natively via
    // <svg><foreignObject> instead of html2canvas's default path of cloning and manually
    // re-implementing CSS layout for the whole document — the default path was measured at
    // several seconds per chart in testing; this path is near-instant for our content.
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, foreignObjectRendering: true });
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } finally {
    root.unmount();
    container.remove();
  }
}
