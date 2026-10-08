import type { QuestionnaireDto, ResponseDto, ScoreResultDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ScoreSummary } from './ScoreSummary';
import { ScoreBreakdownTable } from './ScoreBreakdownTable';
import { E2EChecklistTable } from './E2EChecklistTable';
import { GroupedCommentsList } from './GroupedCommentsList';
import { PersonalCognitiveActivityRadar } from './PersonalCognitiveActivityRadar';
import { formatQuestionLabel, groupByCognitiveActivity } from '../lib/cognitiveActivity';
import { exportSectionsToPdf, type PdfSection } from '../lib/exportPdf';
import { formatSubScenarioLabel } from '../lib/subScenarioCategories';
import { questionPdfLines } from '../lib/questionText';
import { KeiResultsTable } from './KeiResultsTable';
import { buildKeiResultsPdfSection } from '../lib/kei';

// Builds the PDF export's content (MANAGEMENT_VIEW.md item 1) purely from data already on
// this page — headline score, guideline text, per-question options/criteria, score
// breakdown, sub-scenario summary, E2E checklist (when present), and comments grouped by
// Cognitive Activity, mirroring the on-screen sections (including the collapsible Guideline
// and per-question option lists, previously omitted from the export — MANAGEMENT_REVIEW_3.md
// item 5) one-for-one.
function buildPdfSections(
  questionnaire: QuestionnaireDto,
  response: ResponseDto,
  result: ScoreResultDto,
): PdfSection[] {
  const sections: PdfSection[] = [
    {
      kind: 'text',
      lines: [
        `Final score: ${result.finalScore.toFixed(2)} / 4`,
        ...(questionnaire.effectivenessIndicators.length > 0
          ? [`Effective Indicator score: ${result.keiScore != null ? result.keiScore.toFixed(2) : '—'} / 4`]
          : []),
      ],
    },
  ];

  if (questionnaire.guidelineText) {
    sections.push({
      kind: 'text',
      heading: 'Guideline',
      lines: questionnaire.guidelineText.split('\n'),
    });
  }

  // One block per question in the question / note / option look (QUESTION_STYLING_PLAN.md),
  // rather than a table, so the three read as distinctly in the PDF as on screen.
  sections.push({ kind: 'text', heading: 'Questions & options', lines: [] });
  questionnaire.questions.forEach((q, index) => {
    sections.push({
      kind: 'text',
      heading: `${index + 1}. ${formatQuestionLabel(q)}`,
      lines: [
        ...questionPdfLines(q.questionText, q.options),
        ...(q.answeringGuideline ? [{ text: `Guideline: ${q.answeringGuideline}`, style: 'note' as const }] : []),
      ],
    });
  });

  const scoreByKey = new Map(result.questionScores.map((qs) => [`${qs.questionId}:${qs.subScenarioId}`, qs]));
  sections.push({
    kind: 'table',
    heading: 'Score breakdown',
    head: [['Cognitive Activity', 'Service Capability', 'Weight', ...questionnaire.subScenarios.map(formatSubScenarioLabel)]],
    body: questionnaire.questions.map((q) => [
      q.cognitiveActivity,
      q.serviceCapability,
      `${(q.weight * 100).toFixed(0)}%`,
      ...questionnaire.subScenarios.map((s) => {
        const qs = scoreByKey.get(`${q.id}:${s.id}`);
        return qs?.compensatedScore != null ? qs.compensatedScore.toFixed(2) : '—';
      }),
    ]),
  });

  const scoreByCode = new Map(result.subScenarioScores.map((s) => [s.subScenarioCode, s]));
  sections.push({
    kind: 'table',
    heading: 'Sub-scenario summary',
    head: [['Sub-scenario', 'Weight', 'Score']],
    body: questionnaire.subScenarios.map((s) => [
      formatSubScenarioLabel(s),
      `${(s.faultDistributionWeight * 100).toFixed(0)}%`,
      scoreByCode.get(s.code)?.overallScore?.toFixed(2) ?? '—',
    ]),
  });

  if (questionnaire.effectivenessIndicators.length > 0) {
    sections.push(
      buildKeiResultsPdfSection(questionnaire.effectivenessIndicators, response.keiAnswers, result.keiScore),
    );
  }

  if (questionnaire.hasE2ECheck) {
    const answerByKey = new Map(response.answers.map((a) => [`${a.questionId}:${a.subScenarioId}`, a.selectedOption]));
    sections.push({
      kind: 'table',
      heading: `E2E automation checklist (rate: ${(result.e2eAutomationRate * 100).toFixed(1)}%)`,
      head: [['Cognitive Activity', 'Service Capability', ...questionnaire.subScenarios.map(formatSubScenarioLabel)]],
      body: questionnaire.questions.map((q) => [
        q.cognitiveActivity,
        q.serviceCapability,
        ...questionnaire.subScenarios.map((s) => {
          const selected = answerByKey.get(`${q.id}:${s.id}`);
          return selected === 'A' ? 'S' : selected ? 'P' : '–';
        }),
      ]),
    });
  }

  if (response.comments.length > 0) {
    const commentsByQuestionId = new Map<string, ResponseDto['comments']>();
    for (const c of response.comments) {
      const list = commentsByQuestionId.get(c.questionId) ?? [];
      list.push(c);
      commentsByQuestionId.set(c.questionId, list);
    }
    const lines: string[] = [];
    for (const group of groupByCognitiveActivity(questionnaire.questions)) {
      const groupQuestions = group.questions.filter((q) => (commentsByQuestionId.get(q.id)?.length ?? 0) > 0);
      if (groupQuestions.length === 0) continue;
      lines.push(group.name);
      for (const q of groupQuestions) {
        for (const c of commentsByQuestionId.get(q.id)!) {
          const tags = c.subScenarioIds
            .map((id) => questionnaire.subScenarios.find((s) => s.id === id)?.name)
            .filter((n): n is string => !!n);
          lines.push(`  ${formatQuestionLabel(q)} — ${tags.join(', ') || (c.appliesToNone ? 'General remark' : '—')}`);
          lines.push(`    ${c.commentText}`);
        }
      }
    }
    sections.push({ kind: 'text', heading: 'Your comments', lines });
  }

  return sections;
}

// The per-questionnaire result body (headline score, score breakdown, sub-scenario summary,
// E2E checklist, comments) — extracted from ResultsPage.tsx (FORTH_REVIEW.md items 5/6) so
// the Core HVS results page can render this same detail once per member questionnaire
// (Fault Management, Stability) without duplicating the JSX.
export function QuestionnaireResultDetail({
  questionnaire,
  response,
  result,
}: {
  questionnaire: QuestionnaireDto;
  response: ResponseDto;
  result: ScoreResultDto;
}) {
  const hasKeis = questionnaire.effectivenessIndicators.length > 0;
  return (
    <>
      <PersonalCognitiveActivityRadar
        questions={questionnaire.questions}
        questionScores={result.questionScores}
        finalScore={result.finalScore}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '2.5rem', my: 1, fontWeight: 700, color: 'primary.main' }}>
            {result.finalScore.toFixed(2)}{' '}
            <Typography component="span" sx={{ fontSize: '1rem' }} color="text.secondary">
              / 4{hasKeis && ' capability score'}
            </Typography>
          </Typography>
          {/* The Effective Indicator (KEI) score is a separate measure, never blended into
              the capability score above (NEW_HVS_PLAN.md Phase B). */}
          {hasKeis && (
            <Typography sx={{ fontSize: '1.75rem', my: 1, fontWeight: 700 }}>
              {result.keiScore != null ? result.keiScore.toFixed(2) : '—'}{' '}
              <Typography component="span" sx={{ fontSize: '1rem' }} color="text.secondary">
                / 4 effective indicator score
              </Typography>
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          onClick={() =>
            exportSectionsToPdf(
              `${questionnaire.code}-results`,
              `${questionnaire.name} — Results`,
              buildPdfSections(questionnaire, response, result),
            )
          }
        >
          Export to PDF
        </Button>
      </Box>

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Score breakdown
      </Typography>
      <ScoreBreakdownTable
        questions={questionnaire.questions}
        subScenarios={questionnaire.subScenarios}
        questionScores={result.questionScores}
      />

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Sub-scenario summary
      </Typography>
      <ScoreSummary
        finalScore={result.finalScore}
        subScenarios={questionnaire.subScenarios}
        subScenarioScores={result.subScenarioScores}
        hideFinalScore
      />

      {hasKeis && (
        <>
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Key Effectiveness Indicators
          </Typography>
          <KeiResultsTable indicators={questionnaire.effectivenessIndicators} answers={response.keiAnswers} />
        </>
      )}

      {questionnaire.hasE2ECheck && (
        <>
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            E2E automation checklist
          </Typography>
          <E2EChecklistTable
            questions={questionnaire.questions}
            subScenarios={questionnaire.subScenarios}
            answers={response.answers}
            subScenarioScores={result.subScenarioScores}
            e2eAutomationRate={result.e2eAutomationRate}
          />
        </>
      )}

      {response.comments.length > 0 && (
        <>
          <h2 style={{ marginTop: '1.5rem' }}>Your comments</h2>
          <GroupedCommentsList
            questions={questionnaire.questions}
            subScenarios={questionnaire.subScenarios}
            comments={response.comments}
            domain={questionnaire.networkType}
            hvs={questionnaire.hvsCategory}
          />
        </>
      )}
    </>
  );
}
