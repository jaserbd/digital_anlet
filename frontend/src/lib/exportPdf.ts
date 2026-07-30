import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfTableSection {
  kind: 'table';
  heading?: string;
  head: string[][];
  body: (string | number)[][];
}

export interface PdfTextSection {
  kind: 'text';
  heading?: string;
  lines: string[];
}

export interface PdfImageSection {
  kind: 'image';
  heading?: string;
  // PNG data URL (from chartCapture.ts's captureChartImage) plus its natural pixel size —
  // scaled down to fit the page width while preserving aspect ratio.
  dataUrl: string;
  width: number;
  height: number;
}

export type PdfSection = PdfTableSection | PdfTextSection | PdfImageSection;

const PAGE_BOTTOM_MARGIN = 280;
const LEFT_MARGIN = 14;
const PAGE_WIDTH_MM = 210;
const MAX_IMAGE_WIDTH_MM = PAGE_WIDTH_MM - LEFT_MARGIN * 2;
const MAX_TEXT_WIDTH_MM = PAGE_WIDTH_MM - LEFT_MARGIN * 2;

// Client-side PDF export (MANAGEMENT_VIEW.md item 1) — used by a Normal User's/Executive's
// own Results page. Entirely in-browser (no server-rendering dependency), so it stays
// consistent with exportXlsx.ts's client-side approach and the single-host deployment
// model. `jspdf-autotable`'s `finalY` is read off the doc at runtime (not part of its
// published types) to know where to resume drawing after a table.
export function exportSectionsToPdf(filename: string, title: string, sections: PdfSection[]): void {
  const doc = new jsPDF();
  let y = 18;

  // A raw string can (a) be wider than the page — jsPDF's doc.text never wraps on its own,
  // it just draws past the right margin — and (b) contain embedded newlines, which jsPDF
  // *does* silently split into multiple stacked lines using its own line height, without
  // this caller knowing how many lines actually got drawn. Both were real bugs (ADMIN_3.md
  // item 2): the first cuts sentences off at the page border, the second makes the extra
  // line(s) overlap whatever gets drawn next since only one line's worth of `y` was
  // reserved. Splitting on newlines ourselves first, then wrapping each piece to the page
  // width via jsPDF's own splitTextToSize, means every element of the flattened result really
  // is exactly one visual line — safe to advance `y` by a fixed line height per element.
  function wrapLines(text: string): string[] {
    return text.split(/\r\n|\r|\n/).flatMap((piece) => doc.splitTextToSize(piece, MAX_TEXT_WIDTH_MM) as string[]);
  }

  function drawLines(text: string, lineHeight: number): void {
    for (const line of wrapLines(text)) {
      if (y > PAGE_BOTTOM_MARGIN) {
        doc.addPage();
        y = 18;
      }
      doc.text(line, LEFT_MARGIN, y);
      y += lineHeight;
    }
  }

  doc.setFontSize(16);
  drawLines(title, 10);
  doc.setFontSize(11);

  for (const section of sections) {
    if (section.heading) {
      doc.setFontSize(13);
      drawLines(section.heading, 7);
      doc.setFontSize(11);
    }

    if (section.kind === 'text') {
      for (const line of section.lines) {
        drawLines(line, 6);
      }
      y += 3;
    } else if (section.kind === 'image') {
      const scale = Math.min(1, MAX_IMAGE_WIDTH_MM / section.width);
      const drawWidth = section.width * scale;
      const drawHeight = section.height * scale;
      if (y + drawHeight > PAGE_BOTTOM_MARGIN) {
        doc.addPage();
        y = 18;
      }
      doc.addImage(section.dataUrl, 'PNG', LEFT_MARGIN, y, drawWidth, drawHeight);
      y += drawHeight + 8;
    } else {
      autoTable(doc, {
        head: section.head,
        body: section.body,
        startY: y,
        styles: { fontSize: 8 },
        margin: { left: LEFT_MARGIN, right: LEFT_MARGIN },
      });
      const docWithAutoTable = doc as unknown as { lastAutoTable?: { finalY: number } };
      y = (docWithAutoTable.lastAutoTable?.finalY ?? y) + 8;
    }
  }

  doc.save(`${filename}.pdf`);
}
