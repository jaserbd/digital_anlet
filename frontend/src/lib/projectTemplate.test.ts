import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildMembersTemplate, buildProjectTemplate, parseMembersWorkbook, parseProjectWorkbook } from './projectTemplate';

function roundTrip(workbook: XLSX.WorkBook): XLSX.WorkBook {
  return XLSX.read(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
}

function lists(countries: string[]) {
  return { countries, workingDomains: ['RAN', 'Core'], designations: ['Engineer'] };
}

/** The exceljs-built template as SheetJS reads an uploaded file. */
async function template(countries: string[], questionnaires: string[] = []): Promise<XLSX.WorkBook> {
  const buffer = await (await buildProjectTemplate(lists(countries), questionnaires)).xlsx.writeBuffer();
  return XLSX.read(buffer, { type: 'array' });
}

describe('project import template', () => {
  it('parses its own example rows', async () => {
    const parsed = parseProjectWorkbook(await template(['Germany', 'Kenya']));
    expect(parsed.errors).toEqual([]);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.request).toEqual({
      projectName: 'Client A 2026 assessment',
      organizations: ['Client A'],
      natCos: [{ organization: 'Client A', name: 'Client A Germany', country: 'Germany' }],
      members: [
        { organization: '', email: 'consultant@detecon.com', role: 'PROJECT_ADMIN', firstName: 'Jane', lastName: 'Consultant' },
        { organization: 'Client A', email: 'cto@client-a.com', role: 'EXECUTIVE', natCo: 'Client A Germany', country: 'Germany' },
        { organization: 'Client A', email: 'engineer@client-a.com', role: 'NORMAL_USER', natCo: 'Client A Germany', country: 'Germany' },
      ],
    });
  });

  it('accepts reordered columns and role codes, and skips invalid member rows', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['Organization', 'Project name'], ['Org X', 'P1'], ['Org Y', ''], ['', '']]),
      'project',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Email', 'Organization', 'Role', 'First name', 'Last name'],
        ['a@x.com', 'Org X', 'executive', '', ''],
        ['not-an-email', 'Org X', 'Executive', '', ''],
        ['b@x.com', 'Org Y', 'Boss', '', ''],
      ]),
      'Members',
    );
    const parsed = parseProjectWorkbook(roundTrip(workbook));
    expect(parsed.errors).toEqual([]);
    expect(parsed.request?.organizations).toEqual(['Org X', 'Org Y']);
    expect(parsed.request?.natCos).toEqual([]);
    expect(parsed.request?.members).toEqual([{ organization: 'Org X', email: 'a@x.com', role: 'EXECUTIVE' }]);
    expect(parsed.skipped).toEqual([
      'Members row 3: "not-an-email" is not a valid email.',
      'Members row 4: role "Boss" must be Project Admin, Executive or Normal User.',
    ]);
  });

  it('blocks a file without a project name, or with two projects', async () => {
    const workbook = await template([]);
    XLSX.utils.sheet_add_aoa(workbook.Sheets['Project']!, [['Other project', 'Client B']], { origin: 'A3' });
    expect(parseProjectWorkbook(roundTrip(workbook)).errors[0]).toMatch(/one project per file/);

    const noName = await template([]);
    XLSX.utils.sheet_add_aoa(noName.Sheets['Project']!, [['', 'Client A']], { origin: 'A2' });
    expect(parseProjectWorkbook(roundTrip(noName)).errors).toEqual([
      'Project sheet: enter the project name in the "Project name" column.',
    ]);
  });

  it('reads an optional questionnaire selection and lists the questionnaires on the Lists sheet', async () => {
    const workbook = await template(['Germany'], ['RAN Fault Management', 'IP Network Fault Management']);
    expect(XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['Lists']!, { header: 1 })[1]).toEqual([
      'Project Admin',
      'RAN Fault Management',
      'Germany',
      'RAN',
      'Engineer',
    ]);
    XLSX.utils.sheet_add_aoa(workbook.Sheets['Questionnaires']!, [['RAN Fault Management'], [''], ['RAN Fault Management'], ['IP_FM_GB1523E']], {
      origin: 'A2',
    });
    expect(parseProjectWorkbook(roundTrip(workbook)).request?.questionnaires).toEqual([
      'RAN Fault Management',
      'IP_FM_GB1523E',
    ]);
  });

  it('adds drop-down lists for role, organization, questionnaire and country', async () => {
    const workbook = await buildProjectTemplate(lists(['Germany', 'Kenya']), ['RAN Fault Management']);
    const { default: ExcelJS } = await import('exceljs');
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const formula = (sheet: string, cell: string) => {
      const validation = reloaded.getWorksheet(sheet)!.getCell(cell).dataValidation;
      return validation?.type === 'list' ? validation.formulae?.[0] : undefined;
    };
    expect(formula('Members', 'C2')).toBe('Lists!$A$2:$A$4');
    expect(formula('Members', 'C500')).toBe('Lists!$A$2:$A$4');
    expect(formula('Members', 'A2')).toBe('Project!$B$2:$B$100');
    expect(formula('NatCos', 'A2')).toBe('Project!$B$2:$B$100');
    expect(formula('NatCos', 'C2')).toBe('Lists!$C$2:$C$3');
    expect(formula('Questionnaires', 'A2')).toBe('Lists!$B$2:$B$2');
    expect(formula('Members', 'G2')).toBe('Lists!$C$2:$C$3');
    expect(formula('Members', 'H2')).toBe('Lists!$D$2:$D$3');
    expect(formula('Members', 'I2')).toBe('Lists!$E$2:$E$2');
    // Working domain / Designation accept new values; Country doesn't.
    const members = reloaded.getWorksheet('Members')!;
    expect(members.getCell('I2').dataValidation.showErrorMessage).toBeFalsy();
    expect(members.getCell('G2').dataValidation.showErrorMessage).toBe(true);
  });

  it('lets Project Admin rows leave the organization empty, but not other members', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Project name', 'Organization'], ['P1', 'Org X']]), 'Project');
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Organization', 'Email', 'Role', 'First name', 'Last name'],
        ['', 'mike@detecon.com', 'Project Admin', '', ''],
        ['Org X', 'pa2@detecon.com', 'Project Admin', '', ''],
        ['', 'eng@x.com', 'Normal User', '', ''],
      ]),
      'Members',
    );
    const parsed = parseProjectWorkbook(roundTrip(workbook));
    expect(parsed.request?.members).toEqual([
      { organization: '', email: 'mike@detecon.com', role: 'PROJECT_ADMIN' },
      { organization: '', email: 'pa2@detecon.com', role: 'PROJECT_ADMIN' },
    ]);
    expect(parsed.skipped).toEqual(['Members row 4: organization is required (except for Project Admins).']);
  });

  it('reads the optional profile columns, and older files without them', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Project name', 'Organization'], ['P1', 'Org X']]), 'Project');
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Organization', 'Email', 'Role', 'First name', 'Last name', 'Designation', 'natco', 'Working Domain'],
        ['Org X', 'a@x.com', 'Normal User', '', '', ' Sr. Engineer ', 'X Kenya', 'RAN'],
        ['', 'pa@detecon.com', 'Project Admin', '', '', 'Consultant', 'X Kenya', ''],
      ]),
      'Members',
    );
    expect(parseProjectWorkbook(roundTrip(workbook)).request?.members).toEqual([
      { organization: 'Org X', email: 'a@x.com', role: 'NORMAL_USER', natCo: 'X Kenya', workingDomain: 'RAN', designation: 'Sr. Engineer' },
      { organization: '', email: 'pa@detecon.com', role: 'PROJECT_ADMIN' },
    ]);
  });
});

describe('Project Admin member template', () => {
  const context = {
    projectId: 'p1',
    projectName: 'Client A 2026',
    organizations: [
      { id: 'o1', name: 'Client A', natCos: [{ name: 'Client A Kenya', country: 'Kenya' }] },
      { id: 'o2', name: 'Client A Labs', natCos: [] },
    ],
  };

  it('parses its own example rows, with the existing NatCo', async () => {
    const buffer = await (await buildMembersTemplate(context, lists(['Germany', 'Kenya']))).xlsx.writeBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    expect(XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['NatCos']!, { header: 1 })).toEqual([
      ['Organization', 'NatCo', 'Country'],
      ['Client A', 'Client A Kenya', 'Kenya'],
    ]);
    const parsed = parseMembersWorkbook(workbook);
    expect(parsed.errors).toEqual([]);
    expect(parsed.members).toEqual([
      { organization: 'Client A', email: 'cto@client.com', role: 'EXECUTIVE', natCo: 'Client A Kenya', country: 'Kenya' },
      {
        organization: 'Client A',
        email: 'engineer@client.com',
        role: 'NORMAL_USER',
        firstName: 'John',
        lastName: 'Doe',
        natCo: 'Client A Kenya',
        country: 'Kenya',
      },
    ]);
  });

  it('offers only Executive / Normal User and the project\'s organizations', async () => {
    const workbook = await buildMembersTemplate(context, lists(['Germany']));
    const { default: ExcelJS } = await import('exceljs');
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reloaded.getWorksheet('Members')!;
    expect(sheet.getCell('C2').dataValidation.formulae?.[0]).toBe('Lists!$A$2:$A$3');
    expect(sheet.getCell('A2').dataValidation.formulae?.[0]).toBe('Lists!$B$2:$B$3');
    expect(sheet.getCell('F2').dataValidation.formulae?.[0]).toBe('NatCos!$B$2:$B$2');
  });

  it('skips Project Admin rows and rows without an organization', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Organization', 'Email', 'Role', 'First name', 'Last name'],
        ['Client A', 'pa@detecon.com', 'Project Admin', '', ''],
        ['', 'eng@x.com', 'Normal User', '', ''],
        ['Client A', 'ok@x.com', 'Executive', '', ''],
      ]),
      'Members',
    );
    const parsed = parseMembersWorkbook(roundTrip(workbook));
    expect(parsed.members).toEqual([{ organization: 'Client A', email: 'ok@x.com', role: 'EXECUTIVE' }]);
    expect(parsed.skipped).toEqual([
      'Members row 2: role "Project Admin" must be Executive or Normal User.',
      'Members row 3: organization is required.',
    ]);
  });
});
