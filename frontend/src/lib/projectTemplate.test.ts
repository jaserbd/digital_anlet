import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildProjectTemplate, parseProjectWorkbook } from './projectTemplate';

function roundTrip(workbook: XLSX.WorkBook): XLSX.WorkBook {
  return XLSX.read(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
}

describe('project import template', () => {
  it('parses its own example rows', () => {
    const parsed = parseProjectWorkbook(roundTrip(buildProjectTemplate(['Germany', 'Kenya'])));
    expect(parsed.errors).toEqual([]);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.request).toEqual({
      projectName: 'Client A 2026 assessment',
      organizations: ['Client A'],
      natCos: [{ organization: 'Client A', name: 'Client A Germany', country: 'Germany' }],
      members: [
        { organization: 'Client A', email: 'consultant@detecon.com', role: 'PROJECT_ADMIN', firstName: 'Jane', lastName: 'Consultant' },
        { organization: 'Client A', email: 'cto@client-a.com', role: 'EXECUTIVE' },
        { organization: 'Client A', email: 'engineer@client-a.com', role: 'NORMAL_USER' },
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

  it('blocks a file without a project name, or with two projects', () => {
    const workbook = buildProjectTemplate([]);
    XLSX.utils.sheet_add_aoa(workbook.Sheets['Project']!, [['Other project', 'Client B']], { origin: 'A3' });
    expect(parseProjectWorkbook(roundTrip(workbook)).errors[0]).toMatch(/one project per file/);

    const noName = buildProjectTemplate([]);
    XLSX.utils.sheet_add_aoa(noName.Sheets['Project']!, [['', 'Client A']], { origin: 'A2' });
    expect(parseProjectWorkbook(roundTrip(noName)).errors).toEqual([
      'Project sheet: enter the project name in the "Project name" column.',
    ]);
  });
});
