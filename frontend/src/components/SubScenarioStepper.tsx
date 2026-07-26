import type { SubScenarioDto } from '@anlet/shared';

interface SubScenarioStepperProps {
  subScenarios: SubScenarioDto[];
  currentIndex: number;
  isComplete: (subScenarioId: string) => boolean;
  onSelect: (index: number) => void;
}

export function SubScenarioStepper({
  subScenarios,
  currentIndex,
  isComplete,
  onSelect,
}: SubScenarioStepperProps) {
  return (
    <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      {subScenarios.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(i)}
          style={{
            fontWeight: i === currentIndex ? 'bold' : 'normal',
            textDecoration: isComplete(s.id) ? 'underline' : 'none',
          }}
        >
          {i + 1}. {s.name} {isComplete(s.id) ? '✓' : ''}
        </button>
      ))}
    </nav>
  );
}
