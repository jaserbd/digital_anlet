import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { ChartAnimationContext } from '../components/charts/chartAnimation';

export interface CapturedChartImage {
  dataUrl: string;
  width: number;
  height: number;
}

const SCALE = 2;
const MAX_LAYOUT_WAIT_MS = 1000;

// A plain timer rather than requestAnimationFrame — rAF callbacks are heavily throttled (or
// paused entirely) by the browser when the tab isn't the actively-painted foreground tab,
// which would stall report generation if a user switches away mid-download.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Recharts' ResponsiveContainer measures its box via ResizeObserver before drawing its SVG,
// so wait until an SVG with a real size exists (instead of guessing a fixed delay).
async function waitForChart(container: HTMLElement): Promise<void> {
  const started = performance.now();
  while (performance.now() - started < MAX_LAYOUT_WAIT_MS) {
    await wait(16);
    const svg = container.querySelector('svg.recharts-surface');
    if (svg && svg.getBoundingClientRect().width > 0) {
      // One more tick so children laid out from that measurement (labels) are committed.
      await wait(16);
      return;
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render chart image'));
    img.src = src;
  });
}

// Draws one top-level <svg> onto the canvas at its on-screen offset. The SVG is serialized
// as a standalone image, so the font family it would inherit from the page is set inline.
async function drawSvg(ctx: CanvasRenderingContext2D, svg: SVGSVGElement, origin: DOMRect): Promise<void> {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(rect.width));
  clone.setAttribute('height', String(rect.height));
  clone.style.fontFamily = getComputedStyle(svg).fontFamily;
  const markup = new XMLSerializer().serializeToString(clone);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
  ctx.drawImage(img, rect.left - origin.left, rect.top - origin.top, rect.width, rect.height);
}

// Text outside the SVGs — Recharts renders its legend labels as HTML — drawn directly.
function drawHtmlText(ctx: CanvasRenderingContext2D, container: HTMLElement, origin: DOMRect): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    const parent = node.parentElement;
    if (!text || !parent || parent.closest('svg')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0) continue;
    const style = getComputedStyle(parent);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rect.left - origin.left, rect.top - origin.top + rect.height / 2);
  }
}

// Renders `node` (a chart component, e.g. <ScoreBarChart .../>) off-screen at a fixed pixel
// size and returns a PNG data URL — used by pdfSections.tsx to embed chart images in the PDF
// report (jsPDF can't render Recharts' SVG output natively). The chart's own SVG is drawn
// straight onto a canvas (EXECUTIVE_FEEDBACK_PLAN.md): html2canvas took ~1.4 s per chart and
// produced blank images. Animation is off so the chart is complete on its first paint. The
// container needs an explicit width/height (not display:none, which would give
// ResponsiveContainer a zero-size box to measure) but sits far off-screen so nothing flashes.
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
  root.render(<ChartAnimationContext.Provider value={false}>{node}</ChartAnimationContext.Provider>);

  try {
    await waitForChart(container);
    const canvas = document.createElement('canvas');
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const origin = container.getBoundingClientRect();
    // Top-level SVGs only — the legend's icons are small SVGs of their own, nested in HTML.
    const svgs = [...container.querySelectorAll('svg')].filter((svg) => !svg.parentElement?.closest('svg'));
    for (const svg of svgs) {
      await drawSvg(ctx, svg, origin);
    }
    drawHtmlText(ctx, container, origin);
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } finally {
    root.unmount();
    container.remove();
  }
}
