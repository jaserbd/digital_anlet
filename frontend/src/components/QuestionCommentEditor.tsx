import { useEffect, useRef, useState } from 'react';
import type { SubScenarioDto } from '@anlet/shared';

export interface CommentState {
  commentText: string;
  subScenarioIds: string[];
  appliesToNone: boolean;
}

export const EMPTY_COMMENT: CommentState = { commentText: '', subScenarioIds: [], appliesToNone: false };

interface QuestionCommentEditorProps {
  subScenarios: SubScenarioDto[];
  comment: CommentState;
  onChange: (comment: CommentState) => void;
  // Sub-scenario ids with no answer for this question right now (THIRD_REVIEW.md item 1) —
  // used to visually flag which checkboxes must be tagged to cover a skip, and to pre-check
  // them the first time a comment is started. "None of the sub-scenarios" stays selectable
  // regardless (per product decision), but only an explicit tag on the specific unanswered
  // sub-scenario actually satisfies submit-time coverage — see responses.service.ts.
  unansweredSubScenarioIds: string[];
}

const SAVE_DEBOUNCE_MS = 500;

// One comment per question, optionally tagged to specific sub-scenarios or explicitly to
// "None of the sub-scenarios" — mandatory (enforced at submit time, see ReviewStep) only
// when at least one of this question's sub-scenario cells is left unanswered.
//
// All three fields (text, tags, appliesToNone) are kept as one local state object rather
// than reading tags off the `comment` prop: clicking a checkbox while the textarea is
// focused blurs the textarea first, and a blur handler that reads a stale `comment` prop
// (before the parent has re-rendered with the checkbox's own change) can race the
// checkbox's save and silently drop the tag. Local state sidesteps that entirely — both
// handlers always read/write the same up-to-date object. The actual save is debounced so
// a rapid burst of edits (type text, then immediately check a box) coalesces into a single
// network write instead of two racing ones.
export function QuestionCommentEditor({
  subScenarios,
  comment,
  onChange,
  unansweredSubScenarioIds,
}: QuestionCommentEditorProps) {
  const [local, setLocal] = useState<CommentState>(comment);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the user has ever touched a tag checkbox for this question's comment, so
  // the empty->non-empty pre-suggestion (below) only ever fires once and never overwrites a
  // deliberate later choice (e.g. unchecking a pre-suggested tag).
  const tagsTouchedRef = useRef(comment.subScenarioIds.length > 0 || comment.appliesToNone);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleSave(next: CommentState) {
    setLocal(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (next.commentText.trim().length > 0) {
        onChange(next);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function handleTextChange(commentText: string) {
    // First time this question's comment goes from empty to non-empty, with no tags touched
    // yet: pre-suggest tagging every currently-unanswered sub-scenario. Still a suggestion,
    // not a lock — the user can uncheck any of them.
    if (
      local.commentText.trim().length === 0 &&
      commentText.trim().length > 0 &&
      !tagsTouchedRef.current &&
      unansweredSubScenarioIds.length > 0
    ) {
      scheduleSave({ commentText, subScenarioIds: [...unansweredSubScenarioIds], appliesToNone: false });
      return;
    }
    scheduleSave({ ...local, commentText });
  }

  // subScenarioIds and appliesToNone are independent fields (FORTH_REVIEW.md item 2) — a
  // comment can both cover a mandatory skip-tag AND carry a separate general remark, so
  // toggling one no longer clears the other.
  function toggleSubScenario(subScenarioId: string) {
    tagsTouchedRef.current = true;
    const isSelected = local.subScenarioIds.includes(subScenarioId);
    const subScenarioIds = isSelected
      ? local.subScenarioIds.filter((id) => id !== subScenarioId)
      : [...local.subScenarioIds, subScenarioId];
    scheduleSave({ ...local, subScenarioIds });
  }

  function toggleNone() {
    tagsTouchedRef.current = true;
    scheduleSave({ ...local, appliesToNone: !local.appliesToNone });
  }

  return (
    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #eee' }}>
      <label>
        Comment
        <textarea
          value={local.commentText}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={2}
          placeholder="Optional — required if you leave any sub-scenario unanswered above"
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      {local.commentText.trim().length > 0 && (
        <fieldset style={{ marginTop: '0.5rem', border: 'none', padding: 0 }}>
          <legend style={{ fontSize: '0.85em', color: '#666' }}>
            This comment applies to:{' '}
            {unansweredSubScenarioIds.length > 0 && (
              <span style={{ color: '#b8860b' }}>
                (check every unanswered sub-scenario below — highlighted — to cover it)
              </span>
            )}{' '}
            You can also check &quot;None of the sub-scenarios&quot; at the same time if this
            comment also carries a general remark unrelated to the tagged skip.
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {subScenarios.map((s) => {
              const isUnanswered = unansweredSubScenarioIds.includes(s.id);
              const isTagged = local.subScenarioIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  style={{
                    display: 'flex',
                    gap: '0.3rem',
                    alignItems: 'center',
                    padding: '0.15rem 0.4rem',
                    borderRadius: 4,
                    background: isUnanswered && !isTagged ? '#fff4e5' : undefined,
                    border: isUnanswered ? '1px solid #f0ad4e' : '1px solid transparent',
                  }}
                >
                  <input type="checkbox" checked={isTagged} onChange={() => toggleSubScenario(s.id)} />
                  {s.name}
                  {isUnanswered && <span style={{ fontSize: '0.8em', color: '#b8860b' }}>(unanswered)</span>}
                </label>
              );
            })}
            <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input type="checkbox" checked={local.appliesToNone} onChange={toggleNone} />
              None of the sub-scenarios
            </label>
          </div>
        </fieldset>
      )}
    </div>
  );
}
