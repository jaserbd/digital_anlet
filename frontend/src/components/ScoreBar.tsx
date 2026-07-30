const SCORE_BAR_MAX = 4;
const SCORE_BAR_FILL = '#e20074';
const SCORE_BAR_TRACK = '#e5e7eb';

export function ScoreBar({ value }: { value: number | null }) {
  if (value == null) {
    return <span style={{ color: '#999' }}>—</span>;
  }
  const pct = Math.max(0, Math.min(100, (value / SCORE_BAR_MAX) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div
        style={{
          background: SCORE_BAR_TRACK,
          borderRadius: 4,
          height: 10,
          width: 100,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{ background: SCORE_BAR_FILL, height: '100%', width: `${pct}%`, borderRadius: 4 }} />
      </div>
      <span>{value.toFixed(2)}</span>
    </div>
  );
}
