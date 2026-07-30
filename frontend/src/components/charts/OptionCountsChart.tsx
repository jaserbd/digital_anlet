import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import type { AnswerOption } from '@anlet/shared';

export interface OptionCountsChartRow {
  subScenario: string;
  [option: string]: string | number;
}

// Exported so AnswerDistributionDrilldown.tsx's per-sub-scenario option chips (OVERVIEW.md
// item 9) share the exact same color mapping as this chart's bars.
export const OPTION_COLORS: Record<AnswerOption, string> = {
  A: '#2a78d6',
  B: '#1baf7a',
  C: '#eda100',
  D: '#008300',
};

// Exported so pdfSections.ts's chart-image capture can size its off-screen container to
// match this component's own on-screen height exactly (same convention as
// ScoreBarChart.computeScoreBarChartHeight).
export const OPTION_COUNTS_CHART_HEIGHT = 300;

// Per-question answer-distribution chart (MANAGEMENT_REVIEW_3.md item 2) — grouped (not
// stacked) bars so each option's count is independently comparable across sub-scenarios,
// with a value label on each bar cap (recommended for <=4 series by the dataviz skill,
// since not every question offers all four options and a shared 0 baseline would otherwise
// be ambiguous).
export function OptionCountsChart({ data, options }: { data: OptionCountsChartRow[]; options: AnswerOption[] }) {
  if (data.length === 0) {
    return null;
  }
  // Sub-scenario names (e.g. "Communication and Quality of Service") were colliding/clipping
  // as horizontal labels — angle them. XAxis height must reserve enough room for the longest
  // label's diagonal extent, not just a fixed guess, or it bleeds into the Legend below it
  // (verified in the browser: a 60px reservation wasn't enough for that specific label).
  return (
    <div style={{ width: '100%', height: OPTION_COUNTS_CHART_HEIGHT, minWidth: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 8, left: 4 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid stroke="#e1e0d9" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="subScenario"
            tick={{ fill: '#52514e', fontSize: 11 }}
            axisLine={{ stroke: '#c3c2b7' }}
            tickLine={false}
            angle={-20}
            textAnchor="end"
            height={100}
            interval={0}
          />
          <YAxis allowDecimals={false} tick={{ fill: '#898781', fontSize: 11 }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #e1e0d9' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {options.map((option) => (
            <Bar key={option} dataKey={option} name={`Option ${option}`} fill={OPTION_COLORS[option]} radius={[4, 4, 0, 0]} barSize={20}>
              <LabelList dataKey={option} position="top" style={{ fontSize: 10, fill: '#52514e' }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
