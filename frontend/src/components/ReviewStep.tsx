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
  skippedCoveredCount: number;
  comments: CommentSummaryEntry[];
}

// Shown as the final step before Submit: a warning summary of any unanswered questions that
// still need a covering comment, then a dedicated list of every comment the user added
// (per FIRST_REVIEW.md's "dedicated section for the user comments" requirement).
//
// Terminology: "unanswered" is any (question, subScenario) with no selected option. Once an
// unanswered pair is covered by a comment it's a "skip" (submittable, scored via
// re-normalization); until then it's just "unanswered" and blocks submission.
export function ReviewStep({ uncovered, skippedCoveredCount, comments }: ReviewStepProps) {
  return (
    <section>
      <h2>Review before submitting</h2>
      {uncovered.length > 0 ? (
        <div style={{ background: '#fff4e5', border: '1px solid #f0ad4e', borderRadius: 4, padding: '1rem' }}>
          <p>
            <strong>
              You have {uncovered.length} unanswered question{uncovered.length === 1 ? '' : 's'} without a
              covering comment.
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
      {skippedCoveredCount > 0 && (
        <p style={{ color: '#666' }}>
          {skippedCoveredCount} question{skippedCoveredCount === 1 ? ' is' : 's are'} left unanswered but
          covered by a comment — these will be scored as skipped (excluded and re-normalized), not as 0.
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
