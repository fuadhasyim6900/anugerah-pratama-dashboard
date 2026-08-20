import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface BarSeries {
  key: string;
  color: string;
  name: string;
}

interface LineSeries {
  key: string;
  color: string;
  name: string;
  dashed?: boolean;
}

// A combo chart with two independent Y axes: bars (left axis) for one unit
// (e.g. Rupiah) and lines (right axis) for a very different unit (e.g. AO
// count), so both can be read on the same chart without one dwarfing the
// other's scale.
export default function DualAxisComboChart({
  data, xKey, bars, lines, height = 320, leftFormatter, rightFormatter, leftTooltipFormatter, rightTooltipFormatter,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: BarSeries[];
  lines: LineSeries[];
  height?: number;
  leftFormatter: (v: number) => string;
  rightFormatter: (v: number) => string;
  leftTooltipFormatter?: (v: number) => string;
  rightTooltipFormatter?: (v: number) => string;
}) {
  const barKeys = new Set(bars.map((b) => b.key));
  const fmtLeftTooltip = leftTooltipFormatter || leftFormatter;
  const fmtRightTooltip = rightTooltipFormatter || rightFormatter;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 22, right: 20, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-ink-100 dark:stroke-ink-800" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tickFormatter={(v) => leftFormatter(v)}
          tick={{ fontSize: 11 }}
          width={70}
          domain={[0, (max: number) => max * 1.12]}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(v) => rightFormatter(v)}
          tick={{ fontSize: 11 }}
          width={60}
          domain={[0, (max: number) => max * 1.2]}
        />
        <Tooltip
          formatter={(v, name) => [barKeys.has(String(name)) ? fmtLeftTooltip(Number(v)) : fmtRightTooltip(Number(v)), name]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((s) => (
          <Bar key={s.key} yAxisId="left" dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} barSize={22} />
        ))}
        {lines.map((s) => (
          <Line
            key={s.key}
            yAxisId="right"
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
