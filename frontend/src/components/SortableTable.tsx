import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

export interface SortableTableColumn<T> {
  key: string;
  header: string;
  // Value used for filtering/sorting — string for text columns, number for numeric ones
  // (null sorts last regardless of direction, so "—" rows don't jump around).
  getValue: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface SortableTableProps<T> {
  columns: SortableTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

// Generic Excel-like sortable/filterable table (SECOND_REVIEW.md item 9) — click a header
// to sort by it, type in a column's filter box to substring-filter it. Used by both Admin's
// cross-org benchmarking table and Executive's own-org OpCo table, since both share the
// same BenchmarkRowDto row shape.
export function SortableTable<T>({ columns, rows, rowKey, emptyMessage }: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredSorted = useMemo(() => {
    let result = rows;
    for (const col of columns) {
      const filterText = filters[col.key]?.trim().toLowerCase();
      if (!filterText) continue;
      result = result.filter((row) => String(col.getValue(row) ?? '').toLowerCase().includes(filterText));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        result = [...result].sort((a, b) => {
          const av = col.getValue(a);
          const bv = col.getValue(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1; // nulls last
          if (bv == null) return -1;
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return result;
  }, [rows, columns, filters, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ ...cellStyle, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort(col.key)}
              >
                {col.header}
                {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ ...cellStyle, fontWeight: 'normal' }}>
                {col.filterable && (
                  <input
                    type="text"
                    placeholder="Filter…"
                    value={filters[col.key] ?? ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.85em' }}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredSorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} style={{ ...cellStyle, textAlign: col.align ?? 'left' }}>
                  {col.render ? col.render(row) : (col.getValue(row) ?? '—')}
                </td>
              ))}
            </tr>
          ))}
          {filteredSorted.length === 0 && (
            <tr>
              <td style={cellStyle} colSpan={columns.length}>
                {emptyMessage ?? 'No rows.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: CSSProperties = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  textAlign: 'left',
};
