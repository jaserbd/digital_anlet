// Shared look of the answering cards (QuestionCard, KeiCard) — ONBOARDING_SECURITY_PLAN.md Phase 5.

export const cardStyle = {
  marginBottom: '1.5rem',
  padding: '1.25rem 1.5rem 1.5rem',
  border: '1px solid #ebe4e8',
  borderTop: '3px solid #e20074',
  borderRadius: 12,
  background: '#ffffff',
  minWidth: 0,
};

export const legendStyle = {
  float: 'left' as const,
  width: '100%',
  padding: 0,
  marginBottom: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  flexWrap: 'wrap' as const,
  fontSize: '1.05rem',
};

export const ordinalStyle = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  borderRadius: 999,
  background: '#e20074',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '0.9rem',
  flexShrink: 0,
};

export const weightStyle = {
  padding: '0.1rem 0.55rem',
  borderRadius: 6,
  background: 'rgba(226,0,116,0.08)',
  color: '#a40058',
  fontSize: '0.8rem',
  fontWeight: 600,
};
