import fs from 'node:fs';
import * as XLSX from 'xlsx';

/** Reads a source workbook from disk. SheetJS 0.20's ES module build no longer reads files
 * itself (XLSX.readFile needs a file system handed to it first), so the bytes are read here. */
export function readWorkbook(filePath: string): XLSX.WorkBook {
  return XLSX.read(fs.readFileSync(filePath));
}
