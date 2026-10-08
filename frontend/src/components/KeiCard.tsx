import { useEffect, useRef, useState } from 'react';
import type { AnswerOption, EffectivenessIndicatorDto, KeiAnswerDto } from '@anlet/shared';
import { isKeiCovered } from '../lib/kei';
import { OptionCard, QuestionText } from './QuestionContent';

interface KeiCardProps {
  indicator: EffectivenessIndicatorDto;
  ordinal: number;
  answer: KeiAnswerDto;
  onChange: (answer: KeiAnswerDto) => void;
}

const TEXT_SAVE_DEBOUNCE_MS = 500;

// One Key Effectiveness Indicator (NEW_HVS_PLAN.md Phase B): the A-C range options, plus an
// optional measured value and a comment. Mandatory to submit — answered, or explained by the
// comment when the respondent can't know it (e.g. no ticket statistics).
//
// Same single-save-path design as QuestionCommentEditor (see its header comment and CLAUDE.md):
// option, value and comment live in one local state object, and every save sends that whole
// object, so there's never more than one in-flight save per indicator carrying a stale field.
// Text edits are debounced; picking an option saves at once (flushing any pending text with
// it). A save still pending on unmount — e.g. typing then clicking Next — is flushed rather
// than dropped.
export function KeiCard({ indicator, ordinal, answer, onChange }: KeiCardProps) {
  const [local, setLocal] = useState<KeiAnswerDto>(answer);
  const pendingRef = useRef<KeiAnswerDto | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (pendingRef.current) {
      onChangeRef.current(pendingRef.current);
      pendingRef.current = null;
    }
  }

  useEffect(() => flush, []);

  function update(next: KeiAnswerDto, immediate: boolean) {
    setLocal(next);
    pendingRef.current = next;
    if (immediate) {
      flush();
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, TEXT_SAVE_DEBOUNCE_MS);
  }

  const covered = isKeiCovered(local);

  return (
    <fieldset
      style={{
        marginBottom: '1.25rem',
        padding: '1rem',
        border: covered ? '1px solid #ccc' : '1px solid #f0ad4e',
        background: covered ? undefined : '#fffaf2',
      }}
    >
      <legend>
        <strong>
          {ordinal}. {indicator.name}
        </strong>{' '}
        — weight {(indicator.weight * 100).toFixed(0)}%
      </legend>
      {indicator.description && <QuestionText text={indicator.description} />}

      <div role="radiogroup" aria-label={`Answer for ${indicator.name}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={{ ...radioLabelStyle, padding: '0 0.65rem' }}>
          <input
            type="radio"
            name={`kei-${indicator.id}`}
            checked={!local.selectedOption}
            onChange={() => update({ ...local, selectedOption: null }, true)}
          />
          <span style={{ color: '#666' }}>No answer</span>
        </label>
        {indicator.options.map((opt) => (
          <OptionCard
            key={opt.option}
            option={opt.option}
            criteria={opt.criteria}
            text={opt.text}
            selected={local.selectedOption === opt.option}
            control={
              <input
                type="radio"
                name={`kei-${indicator.id}`}
                checked={local.selectedOption === opt.option}
                onChange={() => update({ ...local, selectedOption: opt.option as AnswerOption }, true)}
              />
            }
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.75rem' }}>
        <label style={{ flex: '0 1 14rem' }}>
          Measured value <span style={{ color: '#666', fontSize: '0.85em' }}>(optional)</span>
          <input
            type="text"
            value={local.indicatorValue ?? ''}
            maxLength={200}
            placeholder="e.g. 85% or 3.5 hours"
            onChange={(e) => update({ ...local, indicatorValue: e.target.value }, false)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label style={{ flex: '1 1 20rem' }}>
          Comment
          <textarea
            value={local.comment ?? ''}
            rows={2}
            maxLength={5000}
            placeholder="Optional — required if you leave this indicator unanswered"
            onChange={(e) => update({ ...local, comment: e.target.value }, false)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
      </div>
      {!covered && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85em', color: '#b8860b' }}>
          Pick an option, or add a comment explaining why this indicator can&apos;t be answered.
        </p>
      )}
    </fieldset>
  );
}

const radioLabelStyle = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'baseline',
};
