import * as XLSX from 'xlsx';
import type { ProjectImportRequestDto, ProjectMemberRole } from '@anlet/shared';

// Excel project import (PROJECTS_PLAN.md): the downloadable template and its parser. The browser
// parses the workbook and posts JSON to POST /projects/import, which validates everything again
// (organizations in other projects, countries, existing accounts, ...).

export const PROJECT_TEMPLATE_SHEETS = {
  project: 'Project',
  natCos: 'NatCos',
  members: 'Members',
} as const;

const PROJECT_HEADERS = ['Project name', 'Organization'];
const NATCO_HEADERS = ['Organization', 'NatCo', 'Country'];
const MEMBER_HEADERS = ['Organization', 'Email', 'Role', 'First name', 'Last name'];

export const MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  PROJECT_ADMIN: 'Project Admin',
  EXECUTIVE: 'Executive',
  NORMAL_USER: 'Normal User',
};

const ROLE_BY_TEXT = new Map<string, ProjectMemberRole>(
  (Object.entries(MEMBER_ROLE_LABELS) as [ProjectMemberRole, string][]).flatMap(([role, label]) => [
    [label.toLowerCase(), role],
    [role.toLowerCase(), role],
  ]),
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sheetFromRows(rows: (string | number)[][], widths: number[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  return sheet;
}

/** Builds the template workbook. `countries` (the Country list) is listed on a reference sheet,
 * since a NatCo's country must match one of them. */
export function buildProjectTemplate(countries: string[], exampleCountry = countries[0] ?? 'Germany'): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const instructions = [
    ['ANLET — project import template'],
    [],
    ['1. Project: the project name in the first row, and one organization per row (normally just one).'],
    ['   Organizations are created when they do not exist yet; an organization can only belong to one project.'],
    ['2. NatCos (optional): the organization\'s NatCos (OpCos) with their country — leave empty if it has none.'],
    ['   The country must be one of the values on the "Lists" sheet.'],
    ['3. Members: one row per person — organization, email and role (Project Admin, Executive or Normal User).'],
    ['   Project Admins are the Detecon consultants of the project; Executives and Normal Users are client members.'],
    ['   The same email can appear for several organizations. First and last name are optional.'],
    [],
    ['New accounts get a temporary password, listed in the results file you can download after the import.'],
    ['People who already have an account keep their password and are only added to the organization.'],
    ['Importing the same file again is safe: anything that already exists is reported as "existing".'],
  ];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(instructions, [110]), 'Instructions');
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows([PROJECT_HEADERS, ['Client A 2026 assessment', 'Client A']], [32, 32]),
    PROJECT_TEMPLATE_SHEETS.project,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows([NATCO_HEADERS, ['Client A', 'Client A Germany', exampleCountry]], [32, 32, 24]),
    PROJECT_TEMPLATE_SHEETS.natCos,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(
      [
        MEMBER_HEADERS,
        ['Client A', 'consultant@detecon.com', 'Project Admin', 'Jane', 'Consultant'],
        ['Client A', 'cto@client-a.com', 'Executive', '', ''],
        ['Client A', 'engineer@client-a.com', 'Normal User', '', ''],
      ],
      [32, 34, 16, 16, 16],
    ),
    PROJECT_TEMPLATE_SHEETS.members,
  );
  const listRows: string[][] = [['Role', 'Country']];
  const roleLabels = Object.values(MEMBER_ROLE_LABELS);
  for (let i = 0; i < Math.max(roleLabels.length, countries.length); i++) {
    listRows.push([roleLabels[i] ?? '', countries[i] ?? '']);
  }
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(listRows, [18, 28]), 'Lists');
  return workbook;
}

export function downloadProjectTemplate(countries: string[]): void {
  XLSX.writeFile(buildProjectTemplate(countries), 'anlet-project-template.xlsx');
}

export interface ParsedProjectWorkbook {
  request: ProjectImportRequestDto | null;
  // Problems that block the import (missing sheet, no project name, ...).
  errors: string[];
  // Rows left out of the import, e.g. an invalid email or role.
  skipped: string[];
}

type Cell = string | number | boolean | null | undefined;

/** Reads a sheet into objects keyed by its header row (matched case-insensitively, any column
 * order), skipping blank rows. `row` is the Excel row number, for messages. */
function readRows(sheet: XLSX.WorkSheet, headers: string[]): { row: number; values: Record<string, string> }[] | string {
  const grid = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, blankrows: true, defval: '' });
  const headerRow = (grid[0] ?? []).map((c) => String(c ?? '').trim().toLowerCase());
  const indexByHeader = new Map(headers.map((h) => [h, headerRow.indexOf(h.toLowerCase())]));
  const missing = headers.filter((h) => indexByHeader.get(h) === -1);
  if (missing.length > 0) return `missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`;

  const rows: { row: number; values: Record<string, string> }[] = [];
  grid.slice(1).forEach((cells, i) => {
    const values: Record<string, string> = {};
    for (const [header, index] of indexByHeader) values[header] = String(cells[index] ?? '').trim();
    if (Object.values(values).some((v) => v !== '')) rows.push({ row: i + 2, values });
  });
  return rows;
}

function findSheet(workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet | undefined {
  const actual = workbook.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase());
  return actual ? workbook.Sheets[actual] : undefined;
}

export function parseProjectWorkbook(workbook: XLSX.WorkBook): ParsedProjectWorkbook {
  const errors: string[] = [];
  const skipped: string[] = [];

  const sheets = {
    project: findSheet(workbook, PROJECT_TEMPLATE_SHEETS.project),
    natCos: findSheet(workbook, PROJECT_TEMPLATE_SHEETS.natCos),
    members: findSheet(workbook, PROJECT_TEMPLATE_SHEETS.members),
  };
  if (!sheets.project) errors.push('The "Project" sheet is missing — please use the downloaded template.');
  if (!sheets.members) errors.push('The "Members" sheet is missing — please use the downloaded template.');
  if (!sheets.project || !sheets.members) return { request: null, errors, skipped };

  const projectRows = readRows(sheets.project, PROJECT_HEADERS);
  const memberRows = readRows(sheets.members, MEMBER_HEADERS);
  const natCoRows = sheets.natCos ? readRows(sheets.natCos, NATCO_HEADERS) : [];
  if (typeof projectRows === 'string') errors.push(`Project sheet: ${projectRows}.`);
  if (typeof memberRows === 'string') errors.push(`Members sheet: ${memberRows}.`);
  if (typeof natCoRows === 'string') errors.push(`NatCos sheet: ${natCoRows}.`);
  if (typeof projectRows === 'string' || typeof memberRows === 'string' || typeof natCoRows === 'string') {
    return { request: null, errors, skipped };
  }

  const projectNames = [...new Set(projectRows.map((r) => r.values['Project name']!).filter(Boolean))];
  if (projectNames.length === 0) errors.push('Project sheet: enter the project name in the "Project name" column.');
  if (projectNames.length > 1) {
    errors.push(`Project sheet: one project per file — found ${projectNames.map((n) => `"${n}"`).join(', ')}.`);
  }
  const organizations = [...new Set(projectRows.map((r) => r.values['Organization']!).filter(Boolean))];
  if (organizations.length === 0) errors.push('Project sheet: list at least one organization.');

  const natCos: ProjectImportRequestDto['natCos'] = [];
  for (const { row, values } of natCoRows) {
    const natCo = { organization: values['Organization']!, name: values['NatCo']!, country: values['Country']! };
    if (!natCo.organization || !natCo.name || !natCo.country) {
      skipped.push(`NatCos row ${row}: organization, NatCo and country are all required.`);
      continue;
    }
    natCos.push(natCo);
  }

  const members: ProjectImportRequestDto['members'] = [];
  for (const { row, values } of memberRows) {
    const email = values['Email']!;
    const role = ROLE_BY_TEXT.get(values['Role']!.toLowerCase());
    if (!values['Organization']) {
      skipped.push(`Members row ${row}: organization is required.`);
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      skipped.push(`Members row ${row}: "${email}" is not a valid email.`);
      continue;
    }
    if (!role) {
      skipped.push(`Members row ${row}: role "${values['Role']}" must be Project Admin, Executive or Normal User.`);
      continue;
    }
    members.push({
      organization: values['Organization'],
      email,
      role,
      ...(values['First name'] ? { firstName: values['First name'] } : {}),
      ...(values['Last name'] ? { lastName: values['Last name'] } : {}),
    });
  }

  if (errors.length > 0) return { request: null, errors, skipped };
  return { request: { projectName: projectNames[0]!, organizations, natCos, members }, errors, skipped };
}

export async function readProjectWorkbook(file: File): Promise<ParsedProjectWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return parseProjectWorkbook(workbook);
}
