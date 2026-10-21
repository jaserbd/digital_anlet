import * as XLSX from 'xlsx';
import type { ProjectImportRequestDto, ProjectMemberRole } from '@anlet/shared';

// Excel project import (PROJECTS_PLAN.md): the downloadable template and its parser. The browser
// parses the workbook and posts JSON to POST /projects/import, which validates everything again
// (organizations in other projects, countries, existing accounts, ...).

export const PROJECT_TEMPLATE_SHEETS = {
  project: 'Project',
  questionnaires: 'Questionnaires',
  natCos: 'NatCos',
  members: 'Members',
} as const;

const PROJECT_HEADERS = ['Project name', 'Organization'];
const QUESTIONNAIRE_HEADERS = ['Questionnaire'];
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

type ExcelWorkbook = import('exceljs').Workbook;
type ExcelWorksheet = import('exceljs').Worksheet;

// Rows in the template that get drop-downs (well beyond any realistic project size).
const MAX_ROWS = 1000;

function addSheet(workbook: ExcelWorkbook, name: string, rows: string[][], widths: number[]): ExcelWorksheet {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = widths.map((width) => ({ width }));
  rows.forEach((row) => sheet.addRow(row));
  if (name !== 'Instructions' && rows.length > 0) sheet.getRow(1).font = { bold: true };
  return sheet;
}

/** An Excel drop-down list on `range`, fed by `source` (an absolute range on another sheet). */
function addDropdown(sheet: ExcelWorksheet, range: string, source: string, what: string): void {
  // Range-wide validation (one entry per column instead of one per cell); exists at runtime but
  // is missing from exceljs's type definitions.
  const validations = (sheet as ExcelWorksheet & {
    dataValidations: { add(range: string, validation: import('exceljs').DataValidation): void };
  }).dataValidations;
  validations.add(range, {
    type: 'list',
    allowBlank: true,
    formulae: [source],
    showErrorMessage: true,
    errorStyle: 'error',
    errorTitle: `Invalid ${what}`,
    error: `Please pick a ${what} from the list.`,
  });
}

/**
 * Builds the template workbook (with `exceljs`, which — unlike SheetJS community edition — can
 * write Excel drop-down lists; USERS_TABLE_PLAN.md). `countries` (the Country list) and
 * `questionnaires` (the assessment names, Core FM + Stability as one item) go on the "Lists"
 * sheet, which feeds the Role, Questionnaire and Country drop-downs; the Organization drop-downs
 * read the organizations typed on the Project sheet.
 */
export async function buildProjectTemplate(
  countries: string[],
  questionnaires: string[] = [],
  exampleCountry = countries[0] ?? 'Germany',
): Promise<ExcelWorkbook> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const instructions = [
    ['ANLET — project import template'],
    [],
    ['1. Project: the project name in the first row, and one organization per row (normally just one).'],
    ['   Organizations are created when they do not exist yet; an organization can be in several projects.'],
    ['2. Questionnaires (optional): one assessment per row, picked from the drop-down — only these are available'],
    ['   to the project\'s members. Leave it empty for all released assessments (or, for an existing project, to keep its'],
    ['   selection). Assessments marked (R) are still in review at TM Forum and are only included when listed here.'],
    ['3. NatCos (optional): the organization\'s NatCos (OpCos) with their country — leave empty if it has none.'],
    ['4. Members: one row per person — organization, email and role (Project Admin, Executive or Normal User).'],
    ['   Project Admins are the Detecon consultants of the whole project: leave their organization empty. New ones'],
    ['   are created as Detecon members. Existing employees can also be picked on the Projects list without Excel.'],
    ['   Executives and Normal Users are client members of the organization in this project. First/last name optional.'],
    [],
    ['Organization, Questionnaire, Country and Role cells have drop-down lists (fill the Project sheet first).'],
    ['New accounts get a temporary password, listed in the results file you can download after the import.'],
    ['People who already have an account keep their password and are only added to the organization.'],
    ['Importing the same file again is safe: anything that already exists is reported as "existing".'],
  ];
  addSheet(workbook, 'Instructions', instructions, [110]);
  addSheet(workbook, PROJECT_TEMPLATE_SHEETS.project, [PROJECT_HEADERS, ['Client A 2026 assessment', 'Client A']], [32, 32]);
  const questionnaireSheet = addSheet(workbook, PROJECT_TEMPLATE_SHEETS.questionnaires, [QUESTIONNAIRE_HEADERS], [56]);
  const natCoSheet = addSheet(
    workbook,
    PROJECT_TEMPLATE_SHEETS.natCos,
    [NATCO_HEADERS, ['Client A', 'Client A Germany', exampleCountry]],
    [32, 32, 24],
  );
  const memberSheet = addSheet(
    workbook,
    PROJECT_TEMPLATE_SHEETS.members,
    [
      MEMBER_HEADERS,
      ['', 'consultant@detecon.com', 'Project Admin', 'Jane', 'Consultant'],
      ['Client A', 'cto@client-a.com', 'Executive', '', ''],
      ['Client A', 'engineer@client-a.com', 'Normal User', '', ''],
    ],
    [32, 34, 16, 16, 16],
  );
  const roleLabels = Object.values(MEMBER_ROLE_LABELS);
  const listRows: string[][] = [['Role', 'Questionnaire', 'Country']];
  for (let i = 0; i < Math.max(roleLabels.length, questionnaires.length, countries.length); i++) {
    listRows.push([roleLabels[i] ?? '', questionnaires[i] ?? '', countries[i] ?? '']);
  }
  addSheet(workbook, 'Lists', listRows, [18, 56, 28]);

  const organizations = `${PROJECT_TEMPLATE_SHEETS.project}!$B$2:$B$100`;
  addDropdown(memberSheet, `C2:C${MAX_ROWS}`, `Lists!$A$2:$A$${roleLabels.length + 1}`, 'role');
  addDropdown(memberSheet, `A2:A${MAX_ROWS}`, organizations, 'organization');
  addDropdown(natCoSheet, `A2:A${MAX_ROWS}`, organizations, 'organization');
  if (questionnaires.length > 0) {
    addDropdown(questionnaireSheet, `A2:A${MAX_ROWS}`, `Lists!$B$2:$B$${questionnaires.length + 1}`, 'questionnaire');
  }
  if (countries.length > 0) {
    addDropdown(natCoSheet, `C2:C${MAX_ROWS}`, `Lists!$C$2:$C$${countries.length + 1}`, 'country');
  }
  return workbook;
}

export async function downloadProjectTemplate(countries: string[], questionnaires: string[]): Promise<void> {
  const workbook = await buildProjectTemplate(countries, questionnaires);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'anlet-project-template.xlsx';
  link.click();
  URL.revokeObjectURL(url);
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
    questionnaires: findSheet(workbook, PROJECT_TEMPLATE_SHEETS.questionnaires),
    natCos: findSheet(workbook, PROJECT_TEMPLATE_SHEETS.natCos),
    members: findSheet(workbook, PROJECT_TEMPLATE_SHEETS.members),
  };
  if (!sheets.project) errors.push('The "Project" sheet is missing — please use the downloaded template.');
  if (!sheets.members) errors.push('The "Members" sheet is missing — please use the downloaded template.');
  if (!sheets.project || !sheets.members) return { request: null, errors, skipped };

  const projectRows = readRows(sheets.project, PROJECT_HEADERS);
  const memberRows = readRows(sheets.members, MEMBER_HEADERS);
  const natCoRows = sheets.natCos ? readRows(sheets.natCos, NATCO_HEADERS) : [];
  const questionnaireRows = sheets.questionnaires ? readRows(sheets.questionnaires, QUESTIONNAIRE_HEADERS) : [];
  if (typeof projectRows === 'string') errors.push(`Project sheet: ${projectRows}.`);
  if (typeof memberRows === 'string') errors.push(`Members sheet: ${memberRows}.`);
  if (typeof natCoRows === 'string') errors.push(`NatCos sheet: ${natCoRows}.`);
  if (typeof questionnaireRows === 'string') errors.push(`Questionnaires sheet: ${questionnaireRows}.`);
  if (
    typeof projectRows === 'string' ||
    typeof memberRows === 'string' ||
    typeof natCoRows === 'string' ||
    typeof questionnaireRows === 'string'
  ) {
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
    if (!EMAIL_PATTERN.test(email)) {
      skipped.push(`Members row ${row}: "${email}" is not a valid email.`);
      continue;
    }
    if (!role) {
      skipped.push(`Members row ${row}: role "${values['Role']}" must be Project Admin, Executive or Normal User.`);
      continue;
    }
    // Project Admins administer the whole project; everyone else belongs to one organization.
    if (role !== 'PROJECT_ADMIN' && !values['Organization']) {
      skipped.push(`Members row ${row}: organization is required (except for Project Admins).`);
      continue;
    }
    members.push({
      organization: role === 'PROJECT_ADMIN' ? '' : values['Organization']!,
      email,
      role,
      ...(values['First name'] ? { firstName: values['First name'] } : {}),
      ...(values['Last name'] ? { lastName: values['Last name'] } : {}),
    });
  }

  const questionnaires = [...new Set(questionnaireRows.map((r) => r.values['Questionnaire']!).filter(Boolean))];

  if (errors.length > 0) return { request: null, errors, skipped };
  return {
    request: {
      projectName: projectNames[0]!,
      organizations,
      ...(questionnaires.length > 0 ? { questionnaires } : {}),
      natCos,
      members,
    },
    errors,
    skipped,
  };
}

export async function readProjectWorkbook(file: File): Promise<ParsedProjectWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return parseProjectWorkbook(workbook);
}
