import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ScoreBarChartSeries {
  key: string;
  name: string;
  color?: string;
}

export interface ScoreBarChartRow {
  label: string;
  [seriesKey: string]: number | string | null;
}

// Brand accent (ADMIN_3.md item 5, Telekom Magenta) leads the categorical order; the other
// two are unchanged and already validated together via the dataviz skill's palette script.
const DEFAULT_COLORS = ['#e20074', '#1baf7a', '#eda100'];
const ROW_HEIGHT = 28;
const MAX_HEIGHT = 420;
const MIN_HEIGHT = 120;

// Exported so pdfSections.ts's chart-image capture can size its off-screen container to
// match this component's own on-screen height exactly.
export function computeScoreBarChartHeight(rowCount: number): number {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rowCount * ROW_HEIGHT + 40));
}

// Score-comparison bar chart (MANAGEMENT_REVIEW_3.md item 2) — one horizontal bar per row,
// fixed 0–maxValue domain so bar length stays comparable across charts. Horizontal layout
// (category axis on Y) rather than vertical columns so it stays legible with a variable,
// potentially long list of respondents/NatCos without rotating axis labels. A single series
// gets no legend (per the dataviz skill's rule); 2+ series (e.g. Fault Mgmt/Stability/
// Combined) use the fixed categorical color order and a legend.
export function ScoreBarChart({
  data,
  series,
  maxValue = 4,
}: {
  data: ScoreBarChartRow[];
  series: ScoreBarChartSeries[];
  maxValue?: number;
}) {
  if (data.length === 0) {
    return null;
  }
  const height = computeScoreBarChartHeight(data.length);
  const barSize = Math.min(24, Math.max(6, height / data.length / series.length - 2));
  // Labels (e.g. "OrgName — NatCoName") were clipping against a fixed width — size the axis
  // to the longest label instead, capped so a single outlier doesn't crowd out the bars.
  const longestLabelLength = Math.max(...data.map((d) => d.label.length));
  const yAxisWidth = Math.min(240, Math.max(90, longestLabelLength * 6 + 24));

  return (
    <div style={{ width: '100%', height, minWidth: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#e1e0d9" strokeWidth={1} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, maxValue]}
            tick={{ fill: '#898781', fontSize: 11 }}
            axisLine={{ stroke: '#c3c2b7' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={yAxisWidth}
            tick={{ fill: '#52514e', fontSize: 11 }}
            axisLine={{ stroke: '#c3c2b7' }}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : String(value ?? '—'))}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #e1e0d9' }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              radius={[0, 4, 4, 0]}
              barSize={barSize}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
