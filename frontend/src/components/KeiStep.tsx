import type { EffectivenessIndicatorDto, KeiAnswerDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { KeiCard } from './KeiCard';
import { emptyKeiAnswer } from '../lib/kei';

interface KeiStepProps {
  indicators: EffectivenessIndicatorDto[];
  note: string | null;
  answers: Map<string, KeiAnswerDto>;
  onChange: (answer: KeiAnswerDto) => void;
}

// The answering step after the last IAADE question (NEW_HVS_PLAN.md Phase B). KEIs measure
// outcomes (MTTR, automation ratios) rather than capabilities, are answered once rather than
// per sub-scenario, and produce a separate Effective Indicator score.
export function KeiStep({ indicators, note, answers, onChange }: KeiStepProps) {
  return (
    <section>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Key Effectiveness Indicators
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1.5 }}>
        Outcome measures for this scenario, answered once (not per sub-scenario). They produce a
        separate Effective Indicator score, shown next to your capability score. If you don&apos;t
        know a value, leave it unanswered and explain why in its comment.
      </Typography>
      {note && (
        <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
          {note}
        </Alert>
      )}
      {indicators.map((indicator, i) => (
        <KeiCard
          key={indicator.id}
          indicator={indicator}
          ordinal={i + 1}
          answer={answers.get(indicator.id) ?? emptyKeiAnswer(indicator.id)}
          onChange={onChange}
        />
      ))}
    </section>
  );
}
