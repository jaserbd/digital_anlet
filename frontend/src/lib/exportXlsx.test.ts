import { describe, expect, it } from 'vitest';
import { uniqueSheetName } from './exportXlsx';

describe('uniqueSheetName', () => {
  it('keeps a free name and numbers a taken one, case-insensitively', () => {
    expect(uniqueSheetName('Respondents', [])).toBe('Respondents');
    expect(uniqueSheetName('Respondents', ['respondents'])).toBe('Respondents (2)');
    expect(uniqueSheetName('Respondents', ['Respondents', 'Respondents (2)'])).toBe('Respondents (3)');
  });

  it('stays within Excel\'s 31 characters', () => {
    const long = 'A'.repeat(31);
    const result = uniqueSheetName(long, [long]);
    expect(result).toHaveLength(31);
    expect(result.endsWith(' (2)')).toBe(true);
  });
});
