import { describe, expect, it } from 'vitest';
import { splitQuestionNote } from './questionText';

describe('splitQuestionNote', () => {
  it('returns the whole text when there is no note', () => {
    expect(splitQuestionNote('Does the system predict faults?')).toEqual({
      question: 'Does the system predict faults?',
      note: null,
    });
  });

  // The marker variants found in the seeded workbooks.
  it.each([
    ['RAN', 'Question?\nNote: \nBased on the intent...', 'Note: \nBased on the intent...'],
    ['Core FM', 'Question?\n\nNOTE: Fault rectification...', 'NOTE: Fault rectification...'],
    ['Core numbered', 'Question? \n\nNOTE 1: There are modules\nNOTE 2: More', 'NOTE 1: There are modules\nNOTE 2: More'],
    ['IP (Windows newlines)', 'Question?\r\n\r\nNote: \r\n1) Intent could be', 'Note: \n1) Intent could be'],
    ['Fixed Access spaced colon', 'Question?\r\n\r\nNote : LOS/LOF/LOM', 'Note : LOS/LOF/LOM'],
  ])('splits the %s note format', (_label, text, note) => {
    const result = splitQuestionNote(text);
    expect(result.question).toMatch(/^Question\?$/);
    expect(result.note).toBe(note);
  });

  it('does not split on "note" inside a sentence', () => {
    expect(splitQuestionNote('Please note: this is one sentence.').note).toBeNull();
    expect(splitQuestionNote('Does it annotate: alarms?').note).toBeNull();
  });

  it('keeps text whole when it starts with a note', () => {
    expect(splitQuestionNote('Note: only a note').note).toBeNull();
  });
});
