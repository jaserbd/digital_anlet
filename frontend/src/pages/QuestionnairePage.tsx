import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AnswerOption } from '@anlet/shared';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { QuestionCard } from '../components/QuestionCard';
import { SubScenarioStepper } from '../components/SubScenarioStepper';
import { LogoutButton } from '../components/LogoutButton';

// Hardcoded for MVP — a questionnaire-selection screen arrives with Core Network FM
// (Phase 4, see CLAUDE.md).
const QUESTIONNAIRE_CODE = 'RAN_FM_GB1059A';

function answerKey(questionId: string, subScenarioId: string) {
  return `${questionId}:${subScenarioId}`;
}

export function QuestionnairePage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerOption>>(new Map());
  const [hydrated, setHydrated] = useState(false);

  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', QUESTIONNAIRE_CODE],
    queryFn: () => questionnaireApi.get(QUESTIONNAIRE_CODE),
  });

  const responseQuery = useQuery({
    queryKey: ['response', QUESTIONNAIRE_CODE],
    queryFn: () => responsesApi.getOrCreate(QUESTIONNAIRE_CODE),
  });

  // Hydrate local answer state from the server once, on first load (resume support).
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

  const submitMutation = useMutation({
    mutationFn: () => responsesApi.submit(responseQuery.data!.id),
    onSuccess: () => navigate(`/results/${responseQuery.data!.id}`),
  });

  const totalRequired = useMemo(
    () =>
      questionnaireQuery.data
        ? questionnaireQuery.data.questions.length * questionnaireQuery.data.subScenarios.length
        : 0,
    [questionnaireQuery.data],
  );
  const answeredCount = answers.size;
  const isComplete = totalRequired > 0 && answeredCount >= totalRequired;

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
  const currentSubScenario = questionnaire.subScenarios[stepIndex];

  function isSubScenarioComplete(subScenarioId: string) {
    return questionnaire.questions.every((q) => answers.has(answerKey(q.id, subScenarioId)));
  }

  function handleSelect(questionId: string, subScenarioId: string, option: AnswerOption) {
    setAnswers((prev) => new Map(prev).set(answerKey(questionId, subScenarioId), option));
    answerMutation.mutate({ questionId, subScenarioId, selectedOption: option });
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{questionnaire.name}</h1>
        <LogoutButton />
      </div>
      <p>
        {answeredCount} / {totalRequired} answered
      </p>
      <SubScenarioStepper
        subScenarios={questionnaire.subScenarios}
        currentIndex={stepIndex}
        isComplete={isSubScenarioComplete}
        onSelect={setStepIndex}
      />

      {currentSubScenario && (
        <section>
          <h2>{currentSubScenario.name}</h2>
          <p>{currentSubScenario.description}</p>
          {questionnaire.questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              selected={answers.get(answerKey(q.id, currentSubScenario.id))}
              onSelect={(option) => handleSelect(q.id, currentSubScenario.id, option)}
            />
          ))}
        </section>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
          Previous
        </button>
        {stepIndex < questionnaire.subScenarios.length - 1 ? (
          <button type="button" onClick={() => setStepIndex((i) => i + 1)}>
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={!isComplete || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit'}
          </button>
        )}
      </div>
      {submitMutation.isError && (
        <p style={{ color: 'crimson' }}>Failed to submit. Please try again.</p>
      )}
    </main>
  );
}
