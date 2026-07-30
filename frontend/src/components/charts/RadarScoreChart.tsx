import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ScoreBarChart } from './ScoreBarChart';

export interface RadarScoreChartRow {
  axis: string;
  value: number | null;
}

// A radar chart only reads as a meaningful shape with 3+ axes — Core Network Stability has
// just 2 (Basic stability/Intelligent stability), so it (and any future small-category-count
// questionnaire) gets a bar chart instead (ADMIN_3.md item 4).
const MIN_RADAR_AXES = 3;

// Shared by PersonalCognitiveActivityRadar.tsx and AggregateCognitiveActivityRadar.tsx so the
// radar-vs-bar-chart threshold lives in exactly one place.
export function CognitiveActivityChart({ axes }: { axes: RadarScoreChartRow[] }) {
  return axes.length >= MIN_RADAR_AXES ? (
    <RadarScoreChart data={axes} />
  ) : (
    <ScoreBarChart
      data={axes.map((a) => ({ label: a.axis, score: a.value }))}
      series={[{ key: 'score', name: 'Score' }]}
    />
  );
}

// IAADE/Cognitive-Activity spider chart (ADMIN_2.md item 1) — one axis per Cognitive
// Activity, fixed 0–4 domain so shape is comparable across questionnaires/filters. Single
// series, so no legend (per the dataviz skill's rule — a title/heading above the chart
// already names it). Only meaningful with 3+ axes — callers with fewer (Core Network
// Stability's 2 categories) use ScoreBarChart instead (ADMIN_3.md item 4).
export function RadarScoreChart({ data }: { data: RadarScoreChartRow[] }) {
  if (data.length === 0) {
    return null;
  }
  const chartData = data.map((d) => ({ ...d, value: d.value ?? 0 }));

  return (
    <div style={{ width: '100%', height: 340, minWidth: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="70%">
          <PolarGrid stroke="#e1e0d9" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: '#52514e', fontSize: 12 }} />
          {/* angle=90 matters beyond just where the spoke points: recharts' PolarRadiusAxis
              defaults angle to 0 and always rotates its tick text by (90 - angle) internally
              (see node_modules/recharts/lib/polar/PolarRadiusAxis.js), so leaving it unset
              silently rotates the 0–4 scale labels 90° regardless of anything in this file —
              this was already happening before ADMIN_3.md ever asked about it. Pinning
              angle=90 both points the axis at the first category (already rendered at the top
              by PolarAngleAxis's own default) and zeroes out that rotation, giving genuinely
              upright tick text (ADMIN_3.md item 1, follow-up). */}
          <PolarRadiusAxis
            angle={90}
            domain={[0, 4]}
            tickCount={5}
            axisLine={false}
            tick={{ fill: '#898781', fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : String(value ?? '—'))}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #e1e0d9' }}
          />
          <Radar
            dataKey="value"
            stroke="#e20074"
            fill="#e20074"
            fillOpacity={0.25}
            dot={{ r: 3, fill: '#e20074' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
