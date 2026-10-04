import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Popover from '@mui/material/Popover';

export interface SortableTableColumn<T> {
  key: string;
  header: string;
  // Value used for filtering/sorting — string for text columns, number for numeric ones
  // (null sorts last regardless of direction, so "—" rows don't jump around).
  getValue: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
  // Full control over the filter-row cell (THIRD_REVIEW.md item 8) — e.g. a typeahead
  // combobox instead of the generic substring text input. Takes priority over `filterable`
  // and `filterType` when set; the column's own filtering (if any) is then the renderer's
  // responsibility, not this table's — keeps SortableTable itself domain-agnostic.
  filterRenderer?: () => ReactNode;
  // Excel-style checkbox-list filter (MANAGEMENT_VIEW.md item 2c) — SortableTable derives
  // the distinct value list from getValue() across all rows and manages a selected-value
  // set itself, rather than the plain substring `filterable` input. Ignored if
  // filterRenderer is set.
  filterType?: 'multiselect';
}

type FilterValue = string | Set<string>;

interface SortableTableProps<T> {
  columns: SortableTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  // Fires whenever the filtered/sorted row set changes (not on every render) — lets a
  // parent read exactly what's currently visible, e.g. to compute a "filtered vs. overall
  // average" summary (MANAGEMENT_VIEW.md item 2d) or to export exactly what's on screen.
  onFilteredRowsChange?: (rows: T[]) => void;
}

// Generic Excel-like sortable/filterable table (SECOND_REVIEW.md item 9), rendered on MUI
// Table primitives (OVERVIEW.md item 3 restyle — zebra striping/hover/sticky header come from
// the theme's MuiTableRow/MuiTableHead overrides in theme.ts). Click a header to sort by it,
// filter each column independently (substring text, a checkbox multiselect, or a fully custom
// renderer), with all column filters combined (AND). Used by both Admin's cross-org
// benchmarking table and Executive's own-org OpCo/Respondents tables.
export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  onFilteredRowsChange,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});

  const filteredSorted = useMemo(() => {
    let result = rows;
    for (const col of columns) {
      const filterValue = filters[col.key];
      if (!filterValue) continue;
      if (col.filterType === 'multiselect') {
        const selected = filterValue as Set<string>;
        if (selected.size === 0) continue;
        result = result.filter((row) => selected.has(String(col.getValue(row) ?? '')));
      } else {
        const filterText = String(filterValue).trim().toLowerCase();
        if (!filterText) continue;
        result = result.filter((row) => String(col.getValue(row) ?? '').toLowerCase().includes(filterText));
      }
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

  // Only re-notifies the parent when the *content* of the filtered/sorted row set actually
  // changes, not merely its object identity. `columns`/`rowKey` are typically rebuilt as new
  // array/function literals on every render of the caller, which would otherwise make the
  // `filteredSorted` useMemo above produce a new reference every render even when nothing
  // meaningful changed — calling onFilteredRowsChange(newArray) would then update the
  // caller's own state, re-rendering it, rebuilding `columns` again, and looping forever.
  // Comparing row keys sidesteps that entirely: the effect body may re-run often, but it
  // only calls the (ref-read, so an unmemoized prop is also safe) callback when the actual
  // visible rows differ from last time.
  const onFilteredRowsChangeRef = useRef(onFilteredRowsChange);
  onFilteredRowsChangeRef.current = onFilteredRowsChange;
  const lastNotifiedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const signature = filteredSorted.map(rowKey).join(' ');
    if (signature !== lastNotifiedSignatureRef.current) {
      lastNotifiedSignatureRef.current = signature;
      onFilteredRowsChangeRef.current?.(filteredSorted);
    }
  });

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.align ?? 'left'}>
                <TableSortLabel
                  active={sortKey === col.key}
                  direction={sortKey === col.key ? sortDir : 'asc'}
                  onClick={() => toggleSort(col.key)}
                  sx={{ '&.MuiTableSortLabel-root': { color: 'inherit' }, '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }}
                >
                  {col.header}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} sx={{ bgcolor: 'background.paper' }}>
                {col.filterRenderer ? (
                  col.filterRenderer()
                ) : col.filterType === 'multiselect' ? (
                  <MultiSelectFilter
                    rows={rows}
                    getValue={col.getValue}
                    selected={(filters[col.key] as Set<string>) ?? new Set<string>()}
                    onChange={(next) => setFilters((prev) => ({ ...prev, [col.key]: next }))}
                  />
                ) : (
                  col.filterable && (
                    <TextField
                      variant="standard"
                      placeholder="Filter…"
                      value={(filters[col.key] as string) ?? ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                      fullWidth
                    />
                  )
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredSorted.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.key} align={col.align ?? 'left'}>
                  {col.render ? col.render(row) : (col.getValue(row) ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {filteredSorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length}>{emptyMessage ?? 'No rows.'}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// Excel AutoFilter-style column filter: a select-style trigger ("All" / "2 selected") that
// opens a searchable checkbox list of every distinct value the column takes across all rows
// (not just the currently-filtered rows, matching Excel's own behavior of always listing the
// full value set). The list is an MUI Popover — portaled to the document body — because the
// table's scrolling container would otherwise clip it; it closes on an outside click or Esc.
function MultiSelectFilter<T>({
  rows,
  getValue,
  selected,
  onChange,
}: {
  rows: T[];
  getValue: (row: T) => string | number | null;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [search, setSearch] = useState('');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const uniqueValues = useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      const v = getValue(row);
      if (v != null && v !== '') values.add(String(v));
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [rows, getValue]);

  const visibleValues = uniqueValues.filter((v) => v.toLowerCase().includes(search.trim().toLowerCase()));

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  }

  const label = selected.size === 0 ? 'All' : selected.size === 1 ? [...selected][0] : `${selected.size} selected`;

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-haspopup="listbox"
        title={selected.size > 0 ? [...selected].join(', ') : 'Click to choose values'}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 0.5,
          minWidth: 90,
          maxWidth: 220,
          px: 1,
          py: 0.25,
          fontSize: '0.85em',
          border: '1px solid',
          borderColor: selected.size > 0 ? 'primary.main' : 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          color: selected.size > 0 ? 'primary.main' : 'text.secondary',
          fontWeight: selected.size > 0 ? 600 : 400,
          whiteSpace: 'nowrap',
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </Box>
        <span aria-hidden>▾</span>
      </ButtonBase>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: { sx: { p: 1, minWidth: 240, maxHeight: 360 } },
          // The Popover focuses its own paper on open, which would beat a plain autoFocus —
          // focus the search box once the open transition finishes so typing filters at once.
          transition: { onEntered: () => searchRef.current?.focus() },
        }}
      >
        <TextField
          variant="standard"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputRef={searchRef}
          fullWidth
          sx={{ mb: 0.5 }}
        />
        {selected.size > 0 && (
          <Button size="small" onClick={() => onChange(new Set())} sx={{ mb: 0.5 }}>
            Clear ({selected.size})
          </Button>
        )}
        {visibleValues.map((value) => (
          <Box
            key={value}
            component="label"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Checkbox size="small" checked={selected.has(value)} onChange={() => toggle(value)} sx={{ p: 0.5 }} />
            <Typography variant="body2">{value}</Typography>
          </Box>
        ))}
        {visibleValues.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No matches.
          </Typography>
        )}
      </Popover>
    </>
  );
}
