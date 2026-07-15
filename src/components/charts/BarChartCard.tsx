import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { formatRupiah, formatCompactRupiah } from '../../lib/aggregate';

interface Series {
  key: string;
  color: string;
  name: string;
}

export default function BarChartCard({
  data, xKey, series, height = 300, horizontal = false, valueFormatter,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (v: number) => string;
}) {
  // Tooltip always shows the full nominal; axis/bar labels use a compact
  // "688.9 Juta" / "1.2 M" form so long currency figures stay readable.
  const fmtFull = valueFormatter || ((v: number) => formatRupiah(v));
  const fmtLabel = valueFormatter || ((v: number) => formatCompactRupiah(v));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 36, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-ink-100 dark:stroke-ink-800" />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={(v) => fmtLabel(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey={xKey} width={110} tick={{ fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => fmtLabel(v)} tick={{ fontSize: 11 }} width={70} />
          </>
        )}
        <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey={s.key}
              position={horizontal ? 'right' : 'top'}
              formatter={(v: unknown) => fmtLabel(Number(v))}
              style={{ fontSize: 10, fill: 'currentColor', fontWeight: 600 }}
              className="fill-ink-600 dark:fill-ink-300"
            />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
