export interface UncoveredGap {
  questionId: string;
  questionLabel: string;
  subScenarioId: string;
  subScenarioLabel: string;
}

export interface CommentSummaryEntry {
  questionId: string;
  questionLabel: string;
  commentText: string;
  subScenarioLabels: string[];
  appliesToNone: boolean;
}

interface ReviewStepProps {
  uncovered: UncoveredGap[];
  comments: CommentSummaryEntry[];
}

// Shown as the final step before Submit: a warning summary of any skipped answers that
// still need a covering comment, then a dedicated list of every comment the user added
// (per FIRST_REVIEW.md's "dedicated section for the user comments" requirement).
export function ReviewStep({ uncovered, comments }: ReviewStepProps) {
  return (
    <section>
      <h2>Review before submitting</h2>
      {uncovered.length > 0 ? (
        <div style={{ background: '#fff4e5', border: '1px solid #f0ad4e', borderRadius: 4, padding: '1rem' }}>
          <p>
            <strong>
              You skipped {uncovered.length} answer{uncovered.length === 1 ? '' : 's'} without a covering
              comment.
            </strong>{' '}
            Go back and either answer them, or add a comment tagged to that sub-scenario (or "None of the
            sub-scenarios"), before you can submit.
          </p>
          <ul>
            {uncovered.map((g) => (
              <li key={`${g.questionId}:${g.subScenarioId}`}>
                {g.questionLabel} — {g.subScenarioLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ color: 'green' }}>
          Every question is answered or has a covering comment. You're ready to submit.
        </p>
      )}

      <h3>Your comments</h3>
      {comments.length === 0 ? (
        <p style={{ color: '#666' }}>No comments were added.</p>
      ) : (
        <ul style={{ paddingLeft: '1.25rem' }}>
          {comments.map((c) => (
            <li key={c.questionId} style={{ marginBottom: '0.75rem' }}>
              <strong>{c.questionLabel}</strong>
              <div style={{ fontSize: '0.85em', color: '#666' }}>
                Applies to:{' '}
                {c.appliesToNone
                  ? 'None of the sub-scenarios'
                  : c.subScenarioLabels.length > 0
                    ? c.subScenarioLabels.join(', ')
                    : '—'}
              </div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{c.commentText}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
