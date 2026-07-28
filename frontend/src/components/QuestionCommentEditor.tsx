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
export function QuestionCommentEditor({ subScenarios, comment, onChange }: QuestionCommentEditorProps) {
  const [local, setLocal] = useState<CommentState>(comment);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function toggleSubScenario(subScenarioId: string) {
    const isSelected = local.subScenarioIds.includes(subScenarioId);
    const subScenarioIds = isSelected
      ? local.subScenarioIds.filter((id) => id !== subScenarioId)
      : [...local.subScenarioIds, subScenarioId];
    scheduleSave({ ...local, subScenarioIds, appliesToNone: false });
  }

  function toggleNone() {
    scheduleSave({ ...local, subScenarioIds: [], appliesToNone: !local.appliesToNone });
  }

  return (
    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #eee' }}>
      <label>
        Comment
        <textarea
          value={local.commentText}
          onChange={(e) => scheduleSave({ ...local, commentText: e.target.value })}
          rows={2}
          placeholder="Optional — required if you leave any sub-scenario unanswered above"
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      {local.commentText.trim().length > 0 && (
        <fieldset style={{ marginTop: '0.5rem', border: 'none', padding: 0 }}>
          <legend style={{ fontSize: '0.85em', color: '#666' }}>This comment applies to:</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {subScenarios.map((s) => (
              <label key={s.id} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={local.subScenarioIds.includes(s.id)}
                  onChange={() => toggleSubScenario(s.id)}
                />
                {s.name}
              </label>
            ))}
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
