import { describe, expect, it } from 'vitest';
import { questionnaireInitials } from './questionnaireInitials';

const q = (networkType: string, hvsCategory: string, name = '', inReview = false) => ({ networkType, hvsCategory, name, inReview });

describe('questionnaireInitials', () => {
  it('combines domain and HVS initials', () => {
    expect(questionnaireInitials(q('RAN', 'Fault Management'))).toBe('RAN-FM');
    expect(questionnaireInitials(q('Core', 'Stability'))).toBe('Core-ST');
    expect(questionnaireInitials(q('Fixed Access', 'Fault Management'))).toBe('FA-FM');
  });

  it('tells the two Transport questionnaires apart', () => {
    expect(questionnaireInitials(q('Transport', 'Fault Management', 'Transport Microwave Fault Management'))).toBe('TR-MW-FM');
    expect(questionnaireInitials(q('Transport', 'Fault Management', 'Transport OTN Fault Management'))).toBe('TR-OTN-FM');
  });

  it('tags questionnaires in review and falls back to word initials', () => {
    expect(questionnaireInitials(q('RAN', 'Quality Optimization', '', true))).toBe('RAN-QO (R)');
    expect(questionnaireInitials(q('Cloud Native', 'Network Slicing'))).toBe('CN-NS');
  });
});
