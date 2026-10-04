import { useState } from 'react';
import type { CommentDrilldownEntryDto, CrossOrgCommentEntryDto, QuestionDto, SubScenarioDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SortableTable, type SortableTableColumn } from './SortableTable';
import { exportRowsToXlsx, type XlsxSheet } from '../lib/exportXlsx';
import { formatSubScenarioLabel } from '../lib/subScenarioCategories';

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
  const subScenarioById = new Map(subScenarios.map((s) => [s.id, formatSubScenarioLabel(s)]));
  const rows: CommentCollectionRow[] = [];

  comments.forEach((c, i) => {
    const cognitiveActivity = questionById.get(c.questionId)?.cognitiveActivity ?? '—';
    const subScenarioIds = c.subScenarioIds.length > 0 ? c.subScenarioIds : [null];
    subScenarioIds.forEach((subScenarioId, j) => {
      rows.push({
        key: `${c.questionId}:${c.respondent.userId}:${i}:${j}`,
        email: c.respondent.email,
        opCoName: c.respondent.opCoName,
        country: c.respondent.country,
        designation: c.respondent.designation,
        cognitiveActivity,
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
  return flattenCommentRows(comments, questions, subScenarios, (c) => ({ organizationName: c.organizationName }));
}

export function buildCommentCollectionSheet(rows: CommentCollectionRow[], showOrganizationColumn?: boolean): XlsxSheet {
  return {
    name: 'Comment collection',
    columns: [
      ...(showOrganizationColumn ? [{ header: 'Organization', key: 'organizationName' }] : []),
      { header: 'Email', key: 'email' },
      { header: 'NatCo', key: 'opCoName' },
      { header: 'Country', key: 'country' },
      { header: 'Designation', key: 'designation' },
      { header: 'Cognitive Activity', key: 'cognitiveActivity' },
      { header: 'Sub Scenario', key: 'subScenario' },
      { header: 'Comment', key: 'comment' },
    ],
    rows: rows.map((r) => ({
      organizationName: r.organizationName ?? '',
      email: r.email,
      opCoName: r.opCoName ?? '',
      country: r.country ?? '',
      designation: r.designation ?? '',
      cognitiveActivity: r.cognitiveActivity,
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
}: {
  rows: CommentCollectionRow[];
  domain: string;
  hvs: string;
  title?: string;
  exportFileNamePrefix?: string;
  showOrganizationColumn?: boolean;
}) {
  const [visibleRows, setVisibleRows] = useState<CommentCollectionRow[]>(rows);

  const columns: SortableTableColumn<CommentCollectionRow>[] = [
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
    { key: 'email', header: 'Email', getValue: (r) => r.email, filterType: 'multiselect' },
    { key: 'opCo', header: 'NatCo', getValue: (r) => r.opCoName, filterType: 'multiselect' },
    { key: 'country', header: 'Country', getValue: (r) => r.country, filterType: 'multiselect' },
    { key: 'designation', header: 'Designation', getValue: (r) => r.designation, filterType: 'multiselect' },
    { key: 'cognitiveActivity', header: 'Cognitive Activity', getValue: (r) => r.cognitiveActivity, filterType: 'multiselect' },
    { key: 'subScenario', header: 'Sub Scenario', getValue: (r) => r.subScenario, filterType: 'multiselect' },
    { key: 'comment', header: 'Comment', getValue: (r) => r.comment, filterable: true },
  ];

  function handleExport() {
    if (!exportFileNamePrefix) return;
    exportRowsToXlsx(`${exportFileNamePrefix}-comments`, [buildCommentCollectionSheet(visibleRows, showOrganizationColumn)]);
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
