import type { PdfStyledLine } from './exportPdf';

// Splits a question's text into the question itself and its trailing note
// (QUESTION_STYLING_PLAN.md). The source workbooks keep notes inside the question cell, as a
// paragraph starting "Note:", "Note :", "NOTE:" or "NOTE 1:" — so the split happens here, at
// display time, rather than as a separate stored field.
const NOTE_START = /^[ \t]*note[ \t]*\d*[ \t]*:/im;

export interface SplitQuestionText {
  question: string;
  note: string | null;
}

export function splitQuestionNote(text: string): SplitQuestionText {
  const normalized = text.replace(/\r\n?/g, '\n');
  const match = NOTE_START.exec(normalized);
  // A note on the very first line would leave no question; keep the text whole instead.
  if (!match || match.index === 0) return { question: normalized.trim(), note: null };
  const question = normalized.slice(0, match.index).trim();
  const note = normalized.slice(match.index).trim();
  if (!question) return { question: normalized.trim(), note: null };
  return { question, note };
}

// Shared by the on-screen question components (QuestionContent.tsx) and the PDF reports.
export const QUESTION_COLORS = {
  question: '#0b3d6b',
  noteText: '#4a4f55',
  noteBackground: '#f3f5f8',
  noteBorder: '#9aa5b1',
  optionBackground: '#f8fafc',
  optionBorder: '#dde3ea',
  badge: '#0b3d6b',
  selected: '#a40058',
  selectedBackground: '#fdeef6',
};

// The question, its note and its options as styled PDF lines — the PDF counterpart of
// QuestionContent.tsx's QuestionText + OptionList.
export function questionPdfLines(
  text: string,
  options: { option: string; criteria: number; text: string }[],
): PdfStyledLine[] {
  const { question, note } = splitQuestionNote(text);
  return [
    { text: question, style: 'question' },
    ...(note ? [{ text: note, style: 'note' as const }] : []),
    ...options.map((o) => ({ text: `${o.option} (${o.criteria}): ${o.text}`, style: 'option' as const })),
  ];
}
