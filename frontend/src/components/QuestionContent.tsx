import type { CSSProperties, ReactNode } from 'react';
import { QUESTION_COLORS, splitQuestionNote } from '../lib/questionText';

// Shared look for a question, its note and its A-D options (QUESTION_STYLING_PLAN.md), so the
// question screens, KEI cards and answer-distribution views all tell the three apart the same
// way. Color is never the only signal: the question is also bold and larger, the note italic in
// a bordered box, the options in cards with a badge.
export function QuestionText({ text, compact = false }: { text: string; compact?: boolean }) {
  const { question, note } = splitQuestionNote(text);
  return (
    <div style={{ margin: compact ? '0 0 0.5rem' : '0 0 1rem' }}>
      <p
        style={{
          whiteSpace: 'pre-wrap',
          margin: 0,
          color: QUESTION_COLORS.question,
          fontWeight: 600,
          fontSize: compact ? '1rem' : '1.08rem',
          lineHeight: 1.45,
        }}
      >
        {question}
      </p>
      {note && <NoteBox text={note} />}
    </div>
  );
}

function NoteBox({ text }: { text: string }) {
  return (
    <p
      style={{
        whiteSpace: 'pre-wrap',
        margin: '0.5rem 0 0',
        padding: '0.4rem 0.7rem',
        background: QUESTION_COLORS.noteBackground,
        borderLeft: `3px solid ${QUESTION_COLORS.noteBorder}`,
        borderRadius: 4,
        color: QUESTION_COLORS.noteText,
        fontStyle: 'italic',
        fontSize: '0.88rem',
        lineHeight: 1.45,
      }}
    >
      {text}
    </p>
  );
}

export function OptionBadge({ option, criteria, selected = false }: { option: string; criteria: number; selected?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        flexShrink: 0,
        minWidth: '2.6rem',
        textAlign: 'center',
        padding: '0.05rem 0.45rem',
        borderRadius: 999,
        background: selected ? QUESTION_COLORS.selected : QUESTION_COLORS.badge,
        color: '#ffffff',
        fontWeight: 700,
        fontSize: '0.8rem',
        lineHeight: 1.6,
        fontStyle: 'normal',
      }}
    >
      {option} · {criteria}
    </span>
  );
}

interface OptionCardProps {
  option: string;
  criteria: number;
  text: string;
  selected?: boolean;
  compact?: boolean;
  /** An input (e.g. a radio) shown before the badge; the card then becomes its label. */
  control?: ReactNode;
}

export function OptionCard({ option, criteria, text, selected = false, compact = false, control }: OptionCardProps) {
  const style: CSSProperties = {
    display: 'flex',
    gap: '0.55rem',
    alignItems: 'baseline',
    padding: compact ? '0.25rem 0.55rem' : '0.4rem 0.65rem',
    background: selected ? QUESTION_COLORS.selectedBackground : QUESTION_COLORS.optionBackground,
    border: `1px solid ${selected ? QUESTION_COLORS.selected : QUESTION_COLORS.optionBorder}`,
    borderRadius: 6,
    fontSize: compact ? '0.875rem' : undefined,
    cursor: control ? 'pointer' : undefined,
  };
  const content = (
    <>
      {control}
      <OptionBadge option={option} criteria={criteria} selected={selected} />
      <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
    </>
  );
  return control ? <label style={style}>{content}</label> : <div style={style}>{content}</div>;
}

export function OptionList({
  options,
  compact = false,
}: {
  options: { option: string; criteria: number; text: string }[];
  compact?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.3rem' : '0.4rem', marginBottom: '1rem' }}>
      {options.map((opt) => (
        <OptionCard key={opt.option} option={opt.option} criteria={opt.criteria} text={opt.text} compact={compact} />
      ))}
    </div>
  );
}
