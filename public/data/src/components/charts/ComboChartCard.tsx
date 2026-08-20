import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts';
import { formatRupiah, formatCompactRupiah } from '../../lib/aggregate';
import { useThemeStore } from '../../store/theme';

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

interface PctLabelConfig {
  /** Bar series key that gets the extra "% of target" label (e.g. 'Realisasi'). */
  valueKey: string;
  /** Data key holding the target to divide by (e.g. 'Target'). */
  targetKey: string;
}

// A bar chart (e.g. Target vs Realisasi) with an extra line series drawn on
// top of it (e.g. the Omset trend), so both read as a single combo chart.
export default function ComboChartCard({
  data, xKey, bars, lines, height = 320, valueFormatter, pctLabel,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: BarSeries[];
  lines: LineSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
  /** When set, adds a second label above one bar series showing valueKey/targetKey as a % (e.g. "87% dari target"). */
  pctLabel?: PctLabelConfig;
}) {
  const fmtFull = valueFormatter || ((v: number) => formatRupiah(v));
  const fmtLabel = valueFormatter || ((v: number) => formatCompactRupiah(v));
  // See DsrRankingChart.tsx: `currentColor` + a `fill-*` class doesn't work
  // (inline style always wins), so labels lose their color once dark mode
  // is combined with print/export. Use explicit hex instead.
  const dark = useThemeStore((s) => s.dark);
  const valueLabelColor = dark ? '#d9d9de' : '#52525c'; // ink-200 / ink-600
  const pctLabelColor = '#dc2626'; // brand-600

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: pctLabel ? 52 : 22, right: 20, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-ink-100 dark:stroke-ink-800" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => fmtLabel(v)} tick={{ fontSize: 11 }} width={70} domain={[0, (max: number) => max * 1.12]} />
        <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} barSize={28}>
            <LabelList
              dataKey={s.key}
              position="top"
              formatter={(v: unknown) => fmtLabel(Number(v))}
              style={{ fontSize: 10, fill: valueLabelColor, fontWeight: 600 }}
            />
            {pctLabel && s.key === pctLabel.valueKey && (
              <LabelList
                position="top"
                offset={34}
                valueAccessor={(entry) => {
                  const payload = (entry as { payload?: Record<string, unknown> }).payload || {};
                  const value = Number(payload[pctLabel.valueKey]) || 0;
                  const target = Number(payload[pctLabel.targetKey]) || 0;
                  if (target <= 0) return '';
                  return `(${((value / target) * 100).toFixed(2).replace('.', ',')}%)`;
                }}
                style={{ fontSize: 10, fill: pctLabelColor, fontWeight: 700 }}
              />
            )}
          </Bar>
        ))}
        {lines.map((s) => (
          <Line
            key={s.key}
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
