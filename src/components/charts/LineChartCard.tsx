import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { formatRupiah, formatCompactRupiah } from '../../lib/aggregate';

interface Series {
  key: string;
  color: string;
  name: string;
  dashed?: boolean;
}

export default function LineChartCard({
  data, xKey, series, height = 300, valueFormatter,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  // Tooltip always shows the full nominal; the Y axis and the labels drawn
  // on each line use a compact "656.6 Juta" / "1.2 M" form so the numbers
  // stay readable instead of overlapping.
  const fmtFull = valueFormatter || ((v: number) => formatRupiah(v));
  const fmtLabel = valueFormatter || ((v: number) => formatCompactRupiah(v));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 22, right: 20, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-ink-100 dark:stroke-ink-800" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => fmtLabel(v)} tick={{ fontSize: 11 }} width={70} />
        <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
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
          >
            <LabelList
              dataKey={s.key}
              position="top"
              formatter={(v: unknown) => fmtLabel(Number(v))}
              style={{ fontSize: 10, fontWeight: 600 }}
              className="fill-ink-600 dark:fill-ink-300"
            />
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
