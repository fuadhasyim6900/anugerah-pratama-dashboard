import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { formatRupiah, formatCompactRupiah } from '../../lib/aggregate';
import { useThemeStore } from '../../store/theme';

interface Series {
  key: string;
  color: string;
  name: string;
}

interface PctLabelConfig {
  /** Series key whose bar gets the extra "% of target" label (e.g. 'Omset'). */
  valueKey: string;
  /** Data key holding the target to divide by (e.g. 'Target'). */
  targetKey: string;
}

export default function BarChartCard({
  data, xKey, series, height = 300, horizontal = false, valueFormatter, angledLabels = false, minWidth, pctLabel, onItemClick,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (v: number) => string;
  /** Angle the category-axis tick labels (e.g. many DSR names) so they don't overlap. Only applies when horizontal=false. */
  angledLabels?: boolean;
  /** When set, wraps the chart in a horizontally-scrollable container at least this wide (px), so many categories stay readable instead of being squeezed. */
  minWidth?: number;
  /** When set, adds a second label above one series' bars showing valueKey/targetKey as a % (e.g. "87% dari target"). */
  pctLabel?: PctLabelConfig;
  /** When set, bars become clickable — call with the category (xKey value) that was clicked, e.g. to open a drill-down detail modal. */
  onItemClick?: (label: string) => void;
}) {
  // Tooltip always shows the full nominal; axis/bar labels use a compact
  // "688.9 Juta" / "1.2 M" form so long currency figures stay readable.
  const fmtFull = valueFormatter || ((v: number) => formatRupiah(v));
  const fmtLabel = valueFormatter || ((v: number) => formatCompactRupiah(v));
  // See DsrRankingChart.tsx: `currentColor` + a `fill-*` class doesn't work
  // (inline style always wins), so labels lose their color once dark mode
  // is combined with print/export. Use explicit hex instead.
  const dark = useThemeStore((s) => s.dark);
  const valueLabelColor = dark ? '#d9d9de' : '#52525c'; // ink-200 / ink-600
  const pctLabelColor = '#dc2626'; // brand-600

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: pctLabel ? 58 : 28, right: pctLabel && horizontal ? 80 : 36, left: 0, bottom: angledLabels ? 56 : 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-ink-100 dark:stroke-ink-800" />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={(v) => fmtLabel(v)} tick={{ fontSize: 11 }} domain={[0, (max: number) => max * 1.12]} />
            <YAxis type="category" dataKey={xKey} width={110} tick={{ fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              {...(angledLabels ? { interval: 0, angle: -30, textAnchor: 'end', height: 60 } : {})}
            />
            <YAxis tickFormatter={(v) => fmtLabel(v)} tick={{ fontSize: 11 }} width={70} domain={[0, (max: number) => max * 1.12]} />
          </>
        )}
        <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={[4, 4, 0, 0]}
            cursor={onItemClick ? 'pointer' : undefined}
            onClick={onItemClick ? (entry: unknown) => {
              const payload = (entry as { payload?: Record<string, unknown> })?.payload;
              const label = payload?.[xKey];
              if (typeof label === 'string') onItemClick(label);
            } : undefined}
          >
            <LabelList
              dataKey={s.key}
              position={horizontal ? 'right' : 'top'}
              formatter={(v: unknown) => fmtLabel(Number(v))}
              style={{ fontSize: 10, fill: valueLabelColor, fontWeight: 600 }}
            />
            {pctLabel && s.key === pctLabel.valueKey && (
              <LabelList
                position={horizontal ? 'right' : 'top'}
                offset={horizontal ? 54 : 34}
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
      </BarChart>
    </ResponsiveContainer>
  );

  if (!minWidth) return chart;

  return (
    <div className="w-full overflow-x-auto" data-export-scroll="true">
      <div style={{ minWidth }}>{chart}</div>
    </div>
  );
}
