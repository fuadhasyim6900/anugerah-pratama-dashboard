import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { formatRupiah, formatCompactRupiah } from '../../lib/aggregate';

export interface DsrRankingRow {
  dsr: string;
  Omset: number;
  Target: number;
  pct: number | null; // pencapaian (%) omset dari target DSR itu sendiri
}

// Indonesian-style percentage, e.g. 45.8 -> "45,8".
function formatPercentID(v: number): string {
  return v.toFixed(1).replace('.', ',');
}

// Horizontal bar chart ranking DSR by Omset, with each DSR's own Target
// drawn alongside it. The label on the Omset bar shows both the nominal
// and the achievement percentage against that DSR's own target together —
// e.g. "245,5 Juta (45,8%)" — instead of the percentage alone.
export default function DsrRankingChart({
  data, height,
}: {
  data: DsrRankingRow[];
  height?: number;
}) {
  // Vertical bars: width now scales with number of DSR (via horizontal
  // scroll wrapper below) instead of height like the old horizontal layout.
  const chartHeight = height ?? 380;
  const chartWidth = Math.max(data.length * 90, 480);

  const chartData = data.map((d) => ({
    ...d,
    omsetLabel: `${formatCompactRupiah(d.Omset)} (${d.pct === null ? '-' : `${formatPercentID(d.pct)}%`})`,
  }));

  return (
    <div className="w-full overflow-x-auto" data-export-scroll="true">
      <div style={{ minWidth: chartWidth }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} margin={{ top: 26, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-ink-100 dark:stroke-ink-800" />
            <XAxis dataKey="dsr" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis tickFormatter={(v) => formatCompactRupiah(v)} tick={{ fontSize: 11 }} width={70} domain={[0, (max: number) => max * 1.12]} />
            <Tooltip
              formatter={(v, name, props) => {
                if (name === 'Omset') {
                  const pct = (props.payload as DsrRankingRow).pct;
                  const pctLabel = pct === null ? 'tanpa target' : `${formatPercentID(pct)}% dari target`;
                  return [`${formatRupiah(Number(v))} (${pctLabel})`, 'Omset'];
                }
                return [formatRupiah(Number(v)), name];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Target" name="Target" fill="#d9d9de" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="Target"
                position="top"
                formatter={(v: unknown) => formatCompactRupiah(Number(v))}
                style={{ fontSize: 10, fill: 'currentColor', fontWeight: 600 }}
                className="fill-ink-500 dark:fill-ink-400"
              />
            </Bar>
            <Bar dataKey="Omset" name="Omset" fill="#dc2626" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="omsetLabel"
                position="top"
                style={{ fontSize: 10, fill: 'currentColor', fontWeight: 700 }}
                className="fill-brand-600 dark:fill-brand-400"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
