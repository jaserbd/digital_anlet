// Test-only helpers: score a parsed questionnaire against the demo answers typed into its
// own xlsx, so parser tests can compare our scoring engine with the values the workbook's
// formulas cached (a golden master straight from the source file).
import XLSX from 'xlsx';
import type { AnswerOption, ScoreResultDto } from '@anlet/shared';
import { computeScoreResult } from '../../src/modules/scoring/scoring';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';
import { cellText, readSheetRows, repoRootXlsxPath } from './xlsxParseUtils';

interface DemoAnswerLayout {
  fileName: string;
  questionSheet: string;
  firstQuestionRow: number; // 0-based
  firstSubScenarioColumn: number; // 0-based
}

export function scoreDemoAnswers(
  parsed: ParsedQuestionnaire,
  layout: DemoAnswerLayout,
): ScoreResultDto {
  const workbook = XLSX.readFile(repoRootXlsxPath(layout.fileName));
  const rows = readSheetRows(workbook, layout.questionSheet, layout.fileName);

  const answers = parsed.questions.flatMap((q) =>
    parsed.subScenarios.flatMap((s) => {
      const letter = cellText(
        rows[layout.firstQuestionRow + q.sortOrder]?.[layout.firstSubScenarioColumn + s.sortOrder],
      );
      // Unanswered demo cells (blank, or a stray 0) are treated as skips, as are demo letters
      // for an option the question doesn't offer (the app can't produce those answers).
      return letter && /^[ABCD]$/.test(letter) && q.optionText[letter as AnswerOption] != null
        ? [
            {
              questionId: `q${q.sortOrder}`,
              subScenarioId: s.code,
              selectedOption: letter as AnswerOption,
            },
          ]
        : [];
    }),
  );

  return scoreAnswers(parsed, answers);
}

export function scoreAnswers(
  parsed: ParsedQuestionnaire,
  answers: { questionId: string; subScenarioId: string; selectedOption: AnswerOption }[],
): ScoreResultDto {
  return computeScoreResult({
    questions: parsed.questions.map((q) => ({
      id: `q${q.sortOrder}`,
      weight: q.weight,
      optionCriteria: q.optionCriteria,
      includeInE2ECheck: q.includeInE2ECheck,
    })),
    subScenarios: parsed.subScenarios.map((s) => ({
      id: s.code,
      code: s.code,
      faultDistributionWeight: s.faultDistributionWeight,
    })),
    answers,
  });
}
