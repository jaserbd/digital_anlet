import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { responsesApi } from '../api/responsesApi';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Whether the caller gets "Reset my answers": Application Admins and Project Admins, who answer
 * to test the application (PROJECTS_PLAN.md). The backend enforces the same rule. */
export function useCanResetAnswers(): boolean {
  const { user } = useAuth();
  return !!user && (user.isAdmin || user.role === 'PROJECT_ADMIN');
}

/** Deletes the caller's own response (answers, comments, KEIs, score) so they can start over. */
export function ResetAnswersButton({
  responseId,
  questionnaireCode,
  onReset,
}: {
  responseId: string;
  questionnaireCode: string;
  onReset: () => void;
}) {
  const queryClient = useQueryClient();
  const canReset = useCanResetAnswers();
  const [error, setError] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: () => responsesApi.reset(responseId),
    onSuccess: () => {
      // Reset (not just remove) so an open questionnaire page refetches a fresh, empty response.
      void queryClient.resetQueries({ queryKey: ['response', questionnaireCode] });
      queryClient.removeQueries({ queryKey: ['response-by-id', responseId] });
      queryClient.removeQueries({ queryKey: ['result', responseId] });
      onReset();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to reset your answers'),
  });

  if (!canReset) return null;
  return (
    <>
      <Button
        color="error"
        variant="outlined"
        size="small"
        disabled={reset.isPending}
        onClick={() => {
          if (!window.confirm('Delete all your answers, comments and score for this assessment and start over?')) return;
          setError(null);
          reset.mutate();
        }}
      >
        {reset.isPending ? 'Resetting…' : 'Reset my answers'}
      </Button>
      {error && (
        <Typography variant="caption" color="error" sx={{ ml: 1 }}>
          {error}
        </Typography>
      )}
    </>
  );
}
