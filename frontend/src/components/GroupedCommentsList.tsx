import type { QuestionDto, SubScenarioDto } from '@anlet/shared';
import { formatQuestionLabel, groupByCognitiveActivity } from '../lib/cognitiveActivity';

// Present only in the item 8 (Organization Deep-Dive) multi-respondent context, where the
// same question can carry one comment per respondent across many NatCos.
export interface CommentRespondentIdentity {
  email: string;
  opCoName: string | null;
  country: string | null;
  workingDomain: string | null;
  designation: string | null;
}

export interface CommentEntry {
  questionId: string;
  commentText: string;
  subScenarioIds: string[];
  appliesToNone: boolean;
  respondent?: CommentRespondentIdentity;
}

interface GroupedCommentsListProps {
  questions: QuestionDto[];
  subScenarios: SubScenarioDto[];
  comments: CommentEntry[];
  // Domain (networkType) / HVS (hvsCategory) — constant within a single-questionnaire view
  // (ReviewStep/ResultsPage), so shown once at the top rather than repeated per row. Real
  // variation only shows up once this component is reused across questionnaires (item 8).
  domain?: string;
  hvs?: string;
  emptyMessage?: string;
}

// Structured comment view (THIRD_REVIEW.md item 6): Domain > HVS > Cognitive Activity
// (IAADE) > Sub Scenario > Comment — comment collection is one of this application's main
// purposes, so comments are grouped by Cognitive Activity (not flattened by sub-scenario)
// to keep that structure visible. Comments are bucketed as arrays per question (not one
// value) so this same component serves both a single response's "at most one comment per
// question" view and item 8's org-wide multi-respondent view unchanged.
export function GroupedCommentsList({
  questions,
  subScenarios,
  comments,
  domain,
  hvs,
  emptyMessage = 'No comments were added.',
}: GroupedCommentsListProps) {
  const commentsByQuestionId = new Map<string, CommentEntry[]>();
  for (const c of comments) {
    const list = commentsByQuestionId.get(c.questionId) ?? [];
    list.push(c);
    commentsByQuestionId.set(c.questionId, list);
  }

  const groups = groupByCognitiveActivity(questions)
    .map((group) => ({
      ...group,
      questions: group.questions.filter((q) => (commentsByQuestionId.get(q.id)?.length ?? 0) > 0),
    }))
    .filter((group) => group.questions.length > 0);

  if (groups.length === 0) {
    return <p style={{ color: '#666' }}>{emptyMessage}</p>;
  }

  function subScenarioNames(ids: string[]): string[] {
    return ids
      .map((id) => subScenarios.find((s) => s.id === id)?.name)
      .filter((name): name is string => !!name);
  }

  // subScenarioIds and appliesToNone are independent (FORTH_REVIEW.md item 2) — a comment can
  // carry both a mandatory skip-coverage tag and a separate general remark, so both must be
  // shown rather than one silently hiding the other.
  function formatSubScenarioTags(c: CommentEntry): string {
    const tagged = subScenarioNames(c.subScenarioIds);
    const parts = [
      ...(tagged.length > 0 ? [tagged.join(', ')] : []),
      ...(c.appliesToNone ? ['General remark (not tied to a specific sub-scenario)'] : []),
    ];
    return parts.join(' · ') || '—';
  }

  return (
    <div>
      {(domain || hvs) && (
        <p style={{ color: '#666', fontSize: '0.9em' }}>
          {domain && <>Domain: {domain}</>}
          {domain && hvs && ' · '}
          {hvs && <>HVS: {hvs}</>}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.name} style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>{group.name}</h3>
          {group.questions.map((q) => (
            <div key={q.id} style={{ marginBottom: '0.75rem' }}>
              <strong>{formatQuestionLabel(q)}</strong>
              <ul style={{ paddingLeft: '1.25rem', margin: '0.25rem 0' }}>
                {commentsByQuestionId.get(q.id)!.map((c, i) => (
                  <li key={`${c.questionId}:${i}`} style={{ marginBottom: '0.5rem' }}>
                    {c.respondent && (
                      <div style={{ fontSize: '0.85em', color: '#666' }}>
                        {c.respondent.email}
                        {c.respondent.opCoName && ` · ${c.respondent.opCoName}`}
                        {c.respondent.country && ` (${c.respondent.country})`}
                        {c.respondent.workingDomain && ` · ${c.respondent.workingDomain}`}
                        {c.respondent.designation && ` · ${c.respondent.designation}`}
                      </div>
                    )}
                    <div style={{ fontSize: '0.85em', color: '#666' }}>
                      Sub Scenario: {formatSubScenarioTags(c)}
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0' }}>{c.commentText}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
