// Executives see participants anonymously (ANONYMOUS_EXECUTIVE_PLAN.md): the server then sends
// a pseudonym ("Participant 3") in place of the email and no designation. These helpers keep
// every table and export consistent with that — a "Participant" column instead of "Email", and
// no Designation column.

export function respondentColumnHeader(anonymized?: boolean): string {
  return anonymized ? 'Participant' : 'Email';
}

/** Drops the column keyed `designation` when the data is anonymized. */
export function withoutDesignation<T extends { key: string }>(columns: T[], anonymized?: boolean): T[] {
  return anonymized ? columns.filter((c) => c.key !== 'designation') : columns;
}

/** Sorts "Participant 2" before "Participant 10" (and emails alphabetically). */
export function compareRespondentLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
