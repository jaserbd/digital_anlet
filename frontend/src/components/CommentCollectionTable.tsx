import { useState } from 'react';
import type { CommentDrilldownEntryDto, CrossOrgCommentEntryDto, QuestionDto, SubScenarioDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SortableTable, type SortableTableColumn } from './SortableTable';
import { exportRowsToXlsx, type XlsxSheet } from '../lib/exportXlsx';
import { formatSubScenarioLabel } from '../lib/subScenarioCategories';
import { respondentColumnHeader, withoutDesignation } from '../lib/respondentIdentity';
import { formatQuestionNumberLabel } from '../lib/cognitiveActivity';

export interface CommentCollectionRow {
  key: string;
  // Only populated by buildCrossOrgCommentCollectionRows (ADMIN.md item 3) — undefined for
  // the ordinary org-scoped rows built by buildCommentCollectionRows.
  organizationName?: string | null;
  email: string;
  opCoName: string | null;
  country: string | null;
  designation: string | null;
  cognitiveActivity: string;
  // "Q3 · Fault Prediction" (or "KEI 1 · MTTR") — which question the comment belongs to.
  question: string;
  subScenario: string;
  comment: string;
}

// Shared per-(comment, tagged sub-scenario) flattening — a comment tagged to two
// sub-scenarios produces two rows, and an appliesToNone/untagged comment produces one row
// with Sub Scenario "—". `extra` supplies whatever fields differ between the org-scoped and
// cross-org row shapes (just organizationName, today).
function flattenCommentRows<T extends CommentDrilldownEntryDto>(
  comments: T[],
  questions: QuestionDto[],
  subScenarios: SubScenarioDto[],
  extra: (comment: T) => Partial<CommentCollectionRow>,
): CommentCollectionRow[] {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const questionIndex = new Map(questions.map((q, i) => [q.id, i]));
  const subScenarioById = new Map(subScenarios.map((s) => [s.id, formatSubScenarioLabel(s)]));
  const rows: CommentCollectionRow[] = [];

  // In question order (stable within a question), so a question's comments sit together.
  const ordered = comments
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (questionIndex.get(a.c.questionId) ?? Infinity) - (questionIndex.get(b.c.questionId) ?? Infinity));

  ordered.forEach(({ c, i }) => {
    const q = questionById.get(c.questionId);
    const cognitiveActivity = q?.cognitiveActivity ?? '—';
    const question = q ? formatQuestionNumberLabel(questionIndex.get(c.questionId)! + 1, q) : '—';
    const subScenarioIds = c.subScenarioIds.length > 0 ? c.subScenarioIds : [null];
    subScenarioIds.forEach((subScenarioId, j) => {
      rows.push({
        key: `${c.questionId}:${c.respondent.userId}:${i}:${j}`,
        email: c.respondent.email,
        opCoName: c.respondent.opCoName,
        country: c.respondent.country,
        designation: c.respondent.designation,
        cognitiveActivity,
        question,
        subScenario: subScenarioId ? subScenarioById.get(subScenarioId) ?? subScenarioId : '—',
        comment: c.commentText,
        ...extra(c),
      });
    });
  });

  return rows;
}

export function buildCommentCollectionRows(
  comments: CommentDrilldownEntryDto[],
  questions: QuestionDto[],
  subScenarios: SubScenarioDto[],
): CommentCollectionRow[] {
  return flattenCommentRows(comments, questions, subScenarios, () => ({}));
}

// Cross-organization analogue (ADMIN.md item 3) — every comment for a questionnaire across
// every organization at once, each row carrying its organization name for the Organization
// column shown first (see CommentCollectionTable's showOrganizationColumn prop below).
export function buildCrossOrgCommentCollectionRows(
  comments: CrossOrgCommentEntryDto[],
  questions: QuestionDto[],
  subScenarios: SubScenarioDto[],
): CommentCollectionRow[] {
  // "Project · Organization" (PROJECTS_V2_PLAN.md — the same organization can be in several projects).
  return flattenCommentRows(comments, questions, subScenarios, (c) => ({
    organizationName: c.projectName ? `${c.projectName} · ${c.organizationName}` : c.organizationName,
  }));
}

export function buildCommentCollectionSheet(
  rows: CommentCollectionRow[],
  showOrganizationColumn?: boolean,
  anonymized?: boolean,
): XlsxSheet {
  return {
    name: 'Comment collection',
    columns: withoutDesignation([
      ...(showOrganizationColumn ? [{ header: 'Organization', key: 'organizationName' }] : []),
      { header: respondentColumnHeader(anonymized), key: 'email' },
      { header: 'NatCo', key: 'opCoName' },
      { header: 'Country', key: 'country' },
      { header: 'Designation', key: 'designation' },
      { header: 'Cognitive Activity', key: 'cognitiveActivity' },
      { header: 'Question', key: 'question' },
      { header: 'Sub Scenario', key: 'subScenario' },
      { header: 'Comment', key: 'comment' },
    ], anonymized),
    rows: rows.map((r) => ({
      organizationName: r.organizationName ?? '',
      email: r.email,
      opCoName: r.opCoName ?? '',
      country: r.country ?? '',
      designation: r.designation ?? '',
      cognitiveActivity: r.cognitiveActivity,
      question: r.question,
      subScenario: r.subScenario,
      comment: r.comment,
    })),
  };
}

// Comment Collection Section (MANAGEMENT_REVIEW_3.md item 3) — a flat, exportable table of
// every comment collected for the selected Domain+HVS, additive alongside the per-NatCo
// GroupedCommentsList click-through (OrganizationDeepDivePage). Takes pre-built `rows` (via
// buildCommentCollectionRows or, for the cross-org case, buildCrossOrgCommentCollectionRows)
// rather than raw comments, so the same table/export logic serves both shapes —
// `showOrganizationColumn` renders Organization as the first column for the cross-org case
// (ADMIN.md item 3's explicit ask).
export function CommentCollectionTable({
  rows,
  domain,
  hvs,
  title = 'Comment Collection',
  exportFileNamePrefix,
  showOrganizationColumn,
  anonymized,
}: {
  rows: CommentCollectionRow[];
  domain: string;
  hvs: string;
  title?: string;
  exportFileNamePrefix?: string;
  showOrganizationColumn?: boolean;
  // Executive view: rows carry pseudonyms (ANONYMOUS_EXECUTIVE_PLAN.md).
  anonymized?: boolean;
}) {
  const [visibleRows, setVisibleRows] = useState<CommentCollectionRow[]>(rows);

  const columns: SortableTableColumn<CommentCollectionRow>[] = withoutDesignation<SortableTableColumn<CommentCollectionRow>>([
    ...(showOrganizationColumn
      ? [
          {
            key: 'organization',
            header: 'Organization',
            getValue: (r: CommentCollectionRow) => r.organizationName ?? null,
            filterType: 'multiselect' as const,
          },
        ]
      : []),
    { key: 'email', header: respondentColumnHeader(anonymized), getValue: (r) => r.email, filterType: 'multiselect' },
    { key: 'opCo', header: 'NatCo', getValue: (r) => r.opCoName, filterType: 'multiselect' },
    { key: 'country', header: 'Country', getValue: (r) => r.country, filterType: 'multiselect' },
    { key: 'designation', header: 'Designation', getValue: (r) => r.designation, filterType: 'multiselect' },
    { key: 'cognitiveActivity', header: 'Cognitive Activity', getValue: (r) => r.cognitiveActivity, filterType: 'multiselect' },
    { key: 'question', header: 'Question', getValue: (r) => r.question, filterType: 'multiselect' },
    { key: 'subScenario', header: 'Sub Scenario', getValue: (r) => r.subScenario, filterType: 'multiselect' },
    { key: 'comment', header: 'Comment', getValue: (r) => r.comment, filterable: true },
  ], anonymized);

  function handleExport() {
    if (!exportFileNamePrefix) return;
    exportRowsToXlsx(`${exportFileNamePrefix}-comments`, [buildCommentCollectionSheet(visibleRows, showOrganizationColumn, anonymized)]);
  }

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6">{title}</Typography>
        {exportFileNamePrefix && (
          <Button variant="outlined" onClick={handleExport} disabled={visibleRows.length === 0}>
            Export to Excel
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Domain: {domain} · HVS: {hvs}
      </Typography>
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        onFilteredRowsChange={setVisibleRows}
        emptyMessage="No comments collected yet."
      />
    </div>
  );
}
