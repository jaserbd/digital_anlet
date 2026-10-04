import type { AnswerDrilldownEntryDto, DrilldownRespondentDto, QuestionDto, SubScenarioDto } from '@anlet/shared';
import { formatQuestionLabel, groupByCognitiveActivity } from './cognitiveActivity';
import type { XlsxColumn, XlsxSheet } from './exportXlsx';
import { formatSubScenarioLabel } from './subScenarioCategories';

interface RespondentRow {
  identity: DrilldownRespondentDto;
  // `${questionId}:${subScenarioId}` -> selected option letter
  answers: Map<string, string>;
}

// Inverts the existing per-(question, subScenario, option) drilldown entries (already
// fetched for the on-screen count/click-to-expand view — no separate backend query) into a
// respondent-major matrix for offline analysis (MANAGEMENT_VIEW.md's answer-distribution
// redesign ask): one row per respondent, one column per (question, sub-scenario).
//
// MANAGEMENT_REVIEW_3.md item 4: the original version put every Cognitive Activity's
// columns in one sheet, which got wide and messy fast (a full RAN questionnaire is 8
// questions x 5 sub-scenarios = 40+ answer columns in a single sheet). Split into one sheet
// per Cognitive Activity group instead — mirrors the on-screen grouping
// (AnswerDistributionDrilldown/QuestionStepper) so each sheet stays narrow and readable, at
// the cost of repeating the respondent-identity columns per sheet.
//
// ADMIN_3.md item 3: this used to also interleave a per-question "Comment" column, which
// made an already-wide matrix messier still. Comments now live in their own sheet
// (buildCommentCollectionSheet, added alongside this one by each caller) instead — this
// function is a pure identity + A/B/C/D option matrix.
export function buildAnswerMatrix(
  questions: QuestionDto[],
  subScenarios: SubScenarioDto[],
  entries: AnswerDrilldownEntryDto[],
): XlsxSheet[] {
  const byUser = new Map<string, RespondentRow>();

  for (const entry of entries) {
    for (const r of entry.respondents) {
      let row = byUser.get(r.userId);
      if (!row) {
        row = { identity: r, answers: new Map() };
        byUser.set(r.userId, row);
      }
      row.answers.set(`${entry.questionId}:${entry.subScenarioId}`, entry.option);
    }
  }

  const identityColumns: XlsxColumn[] = [
    { header: 'Email', key: 'email' },
    { header: 'NatCo', key: 'opCoName' },
    { header: 'Country', key: 'country' },
    { header: 'Working Domain', key: 'workingDomain' },
    { header: 'Designation', key: 'designation' },
  ];

  const respondentRows = [...byUser.values()].sort((a, b) => a.identity.email.localeCompare(b.identity.email));

  return groupByCognitiveActivity(questions).map((group) => {
    const columns: XlsxColumn[] = [...identityColumns];
    for (const q of group.questions) {
      for (const s of subScenarios) {
        columns.push({ header: `${formatQuestionLabel(q)} — ${formatSubScenarioLabel(s)}`, key: `answer:${q.id}:${s.id}` });
      }
    }

    const rows = respondentRows.map((row) => {
      const out: Record<string, unknown> = {
        email: row.identity.email,
        opCoName: row.identity.opCoName ?? '',
        country: row.identity.country ?? '',
        workingDomain: row.identity.workingDomain ?? '',
        designation: row.identity.designation ?? '',
      };
      for (const q of group.questions) {
        for (const s of subScenarios) {
          out[`answer:${q.id}:${s.id}`] = row.answers.get(`${q.id}:${s.id}`) ?? '';
        }
      }
      return out;
    });

    return { name: group.name, columns, rows };
  });
}
