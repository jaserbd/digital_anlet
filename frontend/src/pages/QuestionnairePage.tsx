import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AnswerOption } from '@anlet/shared';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { ApiError } from '../api/client';
import { QuestionCard } from '../components/QuestionCard';
import { QuestionStepper } from '../components/QuestionStepper';
import { EMPTY_COMMENT, type CommentState } from '../components/QuestionCommentEditor';
import { ReviewStep, type UncoveredGap } from '../components/ReviewStep';
import type { CommentEntry } from '../components/GroupedCommentsList';
import { PageShell } from '../components/PageShell';
import { formatQuestionLabel } from '../lib/cognitiveActivity';

function answerKey(questionId: string, subScenarioId: string) {
  return `${questionId}:${subScenarioId}`;
}

export function QuestionnairePage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const questionnaireCode = code!;
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerOption>>(new Map());
  const [comments, setComments] = useState<Map<string, CommentState>>(new Map());
  const [hydrated, setHydrated] = useState(false);

  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', questionnaireCode],
    queryFn: () => questionnaireApi.get(questionnaireCode),
  });

  const responseQuery = useQuery({
    queryKey: ['response', questionnaireCode],
    queryFn: () => responsesApi.getOrCreate(questionnaireCode),
  });

  // Hydrate local answer/comment state from the server once, on first load (resume support).
  useEffect(() => {
    if (!hydrated && responseQuery.data) {
      setAnswers(
        new Map(
          responseQuery.data.answers.map((a) => [
            answerKey(a.questionId, a.subScenarioId),
            a.selectedOption,
          ]),
        ),
      );
      setComments(
        new Map(
          responseQuery.data.comments.map((c) => [
            c.questionId,
            { commentText: c.commentText, subScenarioIds: c.subScenarioIds, appliesToNone: c.appliesToNone },
          ]),
        ),
      );
      setHydrated(true);
    }
  }, [hydrated, responseQuery.data]);

  // Once an Admin closes this questionnaire for the user's organization mid-edit (item 7 made
  // acceptance per-org, so this can now happen to an IN_PROGRESS response, not just a
  // SUBMITTED one), a save can 409 without the user otherwise noticing — surface it and
  // refetch the questionnaire so the closed-guard below takes over on the next render.
  const [mutationError, setMutationError] = useState<string | null>(null);
  function handleMutationError(err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      setMutationError('This assessment was just closed by an admin. Your last change was not saved.');
      void questionnaireQuery.refetch();
    } else {
      setMutationError('Failed to save. Please try again.');
    }
  }

  const answerMutation = useMutation({
    mutationFn: (vars: {
      questionId: string;
      subScenarioId: string;
      selectedOption: AnswerOption;
    }) => responsesApi.upsertAnswer(responseQuery.data!.id, vars),
    onError: handleMutationError,
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (vars: { questionId: string; subScenarioId: string }) =>
      responsesApi.deleteAnswer(responseQuery.data!.id, vars.questionId, vars.subScenarioId),
    onError: handleMutationError,
  });

  const commentMutation = useMutation({
    mutationFn: (vars: {
      questionId: string;
      commentText: string;
      subScenarioIds: string[];
      appliesToNone: boolean;
    }) => responsesApi.upsertComment(responseQuery.data!.id, vars),
    onError: handleMutationError,
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitMutation = useMutation({
    mutationFn: () => responsesApi.submit(responseQuery.data!.id),
    onSuccess: () => navigate(`/results/${responseQuery.data!.id}`),
    onError: (err) => {
      setSubmitError(
        err instanceof ApiError && err.status === 422
          ? 'Some unanswered questions are missing a covering comment. Please check the Review step.'
          : 'Failed to submit. Please try again.',
      );
    },
  });

  const totalRequired = useMemo(
    () =>
      questionnaireQuery.data
        ? questionnaireQuery.data.questions.length * questionnaireQuery.data.subScenarios.length
        : 0,
    [questionnaireQuery.data],
  );
  const answeredCount = answers.size;
  const totalUnanswered = totalRequired - answeredCount;

  const uncovered = useMemo<UncoveredGap[]>(() => {
    if (!questionnaireQuery.data) return [];
    const { questions, subScenarios } = questionnaireQuery.data;
    const result: UncoveredGap[] = [];
    for (const q of questions) {
      const comment = comments.get(q.id);
      for (const s of subScenarios) {
        if (answers.has(answerKey(q.id, s.id))) continue;
        const covered =
          !!comment && comment.commentText.trim().length > 0 && comment.subScenarioIds.includes(s.id);
        if (!covered) {
          result.push({
            questionId: q.id,
            questionLabel: formatQuestionLabel(q),
            subScenarioId: s.id,
            subScenarioLabel: s.name,
          });
        }
      }
    }
    return result;
  }, [questionnaireQuery.data, answers, comments]);

  const coverageByQuestionId = useMemo(() => {
    const map = new Map<string, { answeredCount: number; total: number }>();
    if (!questionnaireQuery.data) return map;
    const { questions, subScenarios } = questionnaireQuery.data;
    for (const q of questions) {
      let answeredCount = 0;
      for (const s of subScenarios) {
        if (answers.has(answerKey(q.id, s.id))) answeredCount++;
      }
      map.set(q.id, { answeredCount, total: subScenarios.length });
    }
    return map;
  }, [questionnaireQuery.data, answers]);

  const commentEntries = useMemo<CommentEntry[]>(() => {
    if (!questionnaireQuery.data) return [];
    return questionnaireQuery.data.questions
      .filter((q) => comments.has(q.id) && comments.get(q.id)!.commentText.trim().length > 0)
      .map((q) => {
        const c = comments.get(q.id)!;
        return {
          questionId: q.id,
          commentText: c.commentText,
          subScenarioIds: c.subScenarioIds,
          appliesToNone: c.appliesToNone,
        };
      });
  }, [questionnaireQuery.data, comments]);

  if (questionnaireQuery.isLoading || responseQuery.isLoading || !hydrated) {
    return <p>Loading…</p>;
  }
  if (
    questionnaireQuery.isError ||
    responseQuery.isError ||
    !questionnaireQuery.data ||
    !responseQuery.data
  ) {
    return <p>Something went wrong loading the questionnaire.</p>;
  }

  const questionnaire = questionnaireQuery.data;

  // Once the questionnaire closes for this user's organization (Admin toggle, now
  // per-organization — THIRD_REVIEW.md item 7), a SUBMITTED response is locked exactly like
  // before — redirect straight to results. An IN_PROGRESS response has no results to show,
  // so it gets a plain closed notice instead. While still open, a SUBMITTED user is let back
  // in to keep editing and re-submit (SECOND_REVIEW.md item 1).
  if (!questionnaire.acceptingResponses) {
    if (responseQuery.data.status === 'SUBMITTED') {
      navigate(`/results/${responseQuery.data.id}`, { replace: true });
      return null;
    }
    return (
      <PageShell title={questionnaire.name} maxWidth={800}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This assessment is currently closed for your organization and no longer accepting
          responses.
        </Alert>
        <Button variant="outlined" onClick={() => navigate('/domains')}>
          ← All assessments
        </Button>
      </PageShell>
    );
  }
  const isEditingSubmitted = responseQuery.data.status === 'SUBMITTED';
  const isReviewStep = stepIndex === questionnaire.questions.length;
  const currentQuestion = questionnaire.questions[stepIndex];

  function handleSelect(questionId: string, subScenarioId: string, option: AnswerOption | null) {
    setAnswers((prev) => {
      const next = new Map(prev);
      if (option) {
        next.set(answerKey(questionId, subScenarioId), option);
      } else {
        next.delete(answerKey(questionId, subScenarioId));
      }
      return next;
    });
    if (option) {
      answerMutation.mutate({ questionId, subScenarioId, selectedOption: option });
    } else {
      deleteAnswerMutation.mutate({ questionId, subScenarioId });
    }
  }

  function handleCommentChange(questionId: string, comment: CommentState) {
    setComments((prev) => new Map(prev).set(questionId, comment));
    if (comment.commentText.trim().length > 0) {
      commentMutation.mutate({
        questionId,
        commentText: comment.commentText,
        subScenarioIds: comment.subScenarioIds,
        appliesToNone: comment.appliesToNone,
      });
    }
  }

  const answersForCurrentQuestion = new Map<string, AnswerOption>();
  if (currentQuestion) {
    for (const s of questionnaire.subScenarios) {
      const v = answers.get(answerKey(currentQuestion.id, s.id));
      if (v) answersForCurrentQuestion.set(s.id, v);
    }
  }

  function isQuestionComplete(questionId: string) {
    return !uncovered.some((g) => g.questionId === questionId);
  }

  function jumpToQuestion(questionId: string) {
    const idx = questionnaire.questions.findIndex((q) => q.id === questionId);
    if (idx >= 0) setStepIndex(idx);
  }

  return (
    <PageShell title={questionnaire.name} maxWidth={800}>
      <Button onClick={() => navigate('/domains')} sx={{ mb: 2 }}>
        ← All assessments
      </Button>
      {isEditingSubmitted && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You already submitted this response. You can keep editing and re-submit until an
          admin closes this assessment.
        </Alert>
      )}
      {questionnaire.guidelineText && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 700 }}>Guideline</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {questionnaire.guidelineText}
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {answeredCount} / {totalRequired} answered
        {totalUnanswered - uncovered.length > 0 &&
          ` · ${totalUnanswered - uncovered.length} skipped (covered by a comment)`}
        {uncovered.length > 0 && ` · ${uncovered.length} unanswered, needs a covering comment`}
      </Typography>
      <QuestionStepper
        questions={questionnaire.questions}
        currentIndex={stepIndex}
        isComplete={isQuestionComplete}
        onSelect={setStepIndex}
        coverageByQuestionId={coverageByQuestionId}
      />

      {!isReviewStep && currentQuestion && (
        <QuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
          ordinal={stepIndex + 1}
          subScenarios={questionnaire.subScenarios}
          answers={answersForCurrentQuestion}
          comment={comments.get(currentQuestion.id) ?? EMPTY_COMMENT}
          onSelect={(subScenarioId, option) => handleSelect(currentQuestion.id, subScenarioId, option)}
          onCommentChange={(comment) => handleCommentChange(currentQuestion.id, comment)}
        />
      )}

      {isReviewStep && (
        <ReviewStep
          uncovered={uncovered}
          skippedCoveredCount={totalUnanswered - uncovered.length}
          questions={questionnaire.questions}
          subScenarios={questionnaire.subScenarios}
          comments={commentEntries}
          onJumpTo={jumpToQuestion}
        />
      )}

      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 2 }}>
        <Button variant="outlined" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
          Previous
        </Button>
        {!isReviewStep ? (
          <Button variant="contained" onClick={() => setStepIndex((i) => i + 1)}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={uncovered.length > 0 || submitMutation.isPending}
            onClick={() => {
              setSubmitError(null);
              submitMutation.mutate();
            }}
          >
            {submitMutation.isPending
              ? isEditingSubmitted
                ? 'Updating…'
                : 'Submitting…'
              : isEditingSubmitted
                ? 'Update submission'
                : 'Submit'}
          </Button>
        )}
      </Stack>
      {submitError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {submitError}
        </Alert>
      )}
      {mutationError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {mutationError}
        </Alert>
      )}
    </PageShell>
  );
}
