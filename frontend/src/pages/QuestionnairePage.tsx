import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AnswerOption } from '@anlet/shared';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { ApiError } from '../api/client';
import { QuestionCard } from '../components/QuestionCard';
import { QuestionStepper } from '../components/QuestionStepper';
import { EMPTY_COMMENT, type CommentState } from '../components/QuestionCommentEditor';
import { ReviewStep, type CommentSummaryEntry, type UncoveredGap } from '../components/ReviewStep';
import { LogoutButton } from '../components/LogoutButton';

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

  const answerMutation = useMutation({
    mutationFn: (vars: {
      questionId: string;
      subScenarioId: string;
      selectedOption: AnswerOption;
    }) => responsesApi.upsertAnswer(responseQuery.data!.id, vars),
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (vars: { questionId: string; subScenarioId: string }) =>
      responsesApi.deleteAnswer(responseQuery.data!.id, vars.questionId, vars.subScenarioId),
  });

  const commentMutation = useMutation({
    mutationFn: (vars: {
      questionId: string;
      commentText: string;
      subScenarioIds: string[];
      appliesToNone: boolean;
    }) => responsesApi.upsertComment(responseQuery.data!.id, vars),
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
          !!comment &&
          comment.commentText.trim().length > 0 &&
          (comment.appliesToNone || comment.subScenarioIds.includes(s.id));
        if (!covered) {
          result.push({
            questionId: q.id,
            questionLabel: q.serviceCapability,
            subScenarioId: s.id,
            subScenarioLabel: s.name,
          });
        }
      }
    }
    return result;
  }, [questionnaireQuery.data, answers, comments]);

  const commentSummaries = useMemo<CommentSummaryEntry[]>(() => {
    if (!questionnaireQuery.data) return [];
    const { questions, subScenarios } = questionnaireQuery.data;
    return questions
      .filter((q) => comments.has(q.id) && comments.get(q.id)!.commentText.trim().length > 0)
      .map((q) => {
        const c = comments.get(q.id)!;
        return {
          questionId: q.id,
          questionLabel: q.serviceCapability,
          commentText: c.commentText,
          subScenarioLabels: c.subScenarioIds
            .map((id) => subScenarios.find((s) => s.id === id)?.name)
            .filter((name): name is string => !!name),
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

  if (responseQuery.data.status === 'SUBMITTED') {
    navigate(`/results/${responseQuery.data.id}`, { replace: true });
    return null;
  }

  const questionnaire = questionnaireQuery.data;
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

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{questionnaire.name}</h1>
        <LogoutButton />
      </div>
      <button type="button" onClick={() => navigate('/domains')}>
        ← All assessments
      </button>
      <p>
        {answeredCount} / {totalRequired} answered
        {totalUnanswered - uncovered.length > 0 &&
          ` · ${totalUnanswered - uncovered.length} skipped (covered by a comment)`}
        {uncovered.length > 0 && ` · ${uncovered.length} unanswered, needs a covering comment`}
      </p>
      <QuestionStepper
        questions={questionnaire.questions}
        currentIndex={stepIndex}
        isComplete={isQuestionComplete}
        onSelect={setStepIndex}
      />

      {!isReviewStep && currentQuestion && (
        <QuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
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
          comments={commentSummaries}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
          Previous
        </button>
        {!isReviewStep ? (
          <button type="button" onClick={() => setStepIndex((i) => i + 1)}>
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={uncovered.length > 0 || submitMutation.isPending}
            onClick={() => {
              setSubmitError(null);
              submitMutation.mutate();
            }}
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit'}
          </button>
        )}
      </div>
      {submitError && <p style={{ color: 'crimson' }}>{submitError}</p>}
    </main>
  );
}
