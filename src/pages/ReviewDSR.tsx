import { useMemo } from 'react';
import TopBar from '../components/TopBar';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import { applyFilters, distinctDSR, avgMonthlyAOByDSR, formatRupiah, formatNumber } from '../lib/aggregate';
import { buildDSRInsight } from '../lib/dsrInsights';
import { LoadingState, ErrorState } from './ExecutiveDashboard';
import { AlertTriangle, Lightbulb } from 'lucide-react';

export default function ReviewDSR() {
  const { sales, loading, error } = useSalesData();
  const filters = useFilterStore();

  const filtered = useMemo(
    () => applyFilters(sales, { ...filters, bulan: 0 }),
    [sales, filters]
  );

  const dsrs = useMemo(() => distinctDSR(filtered), [filtered]);
  const avgAOMap = useMemo(() => avgMonthlyAOByDSR(filtered), [filtered]);

  const insights = useMemo(
    () => dsrs.map((dsr) => buildDSRInsight(filtered, dsr))
      .sort((a, b) => b.salesYtd - a.salesYtd),
    [dsrs, filtered]
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <TopBar
        title="Review Kinerja DSR & Solusi Strategis"
        subtitle={`Analisis komprehensif kelemahan setiap DSR di ${filters.depo === 'ALL' ? 'seluruh depo' : `Depo ${filters.depo}`} dan rekomendasi perbaikan untuk peningkatan performa Semester 2 ${filters.tahun}.`}
      />
      <div id="page-content" className="p-6 space-y-5">
        {insights.length === 0 && (
          <div className="card p-6 text-center text-ink-400">Tidak ada data DSR untuk filter yang dipilih.</div>
        )}

        {insights.map((ins) => (
          <div key={ins.dsr} className="card p-5 print-page-break">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-extrabold">{ins.dsr}</h3>
                <span className="inline-block mt-1 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 text-xs font-bold">
                  {ins.tag}
                </span>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs text-ink-400 font-semibold">Sales YTD</p>
                  <p className="font-extrabold">{formatRupiah(ins.salesYtd)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 font-semibold">AO Bulanan (Rerata)</p>
                  <p className="font-extrabold">{formatNumber(avgAOMap.find((a) => a.dsr === ins.dsr)?.avgAo ?? ins.avgAoMonthly)} Outlet</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-brand-600 mb-2">
                  <AlertTriangle size={15} /> Kelemahan Utama
                </h4>
                <ul className="space-y-2 text-sm text-ink-600 dark:text-ink-300">
                  {ins.weaknesses.map((w, i) => {
                    const [title, ...rest] = w.split(':');
                    return (
                      <li key={i} className="pl-3 border-l-2 border-brand-200 dark:border-brand-800">
                        <span className="font-semibold text-ink-900 dark:text-ink-50">{title}:</span>{rest.join(':')}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-600 mb-2">
                  <Lightbulb size={15} /> Solusi / Rekomendasi
                </h4>
                <ul className="space-y-2 text-sm text-ink-600 dark:text-ink-300">
                  {ins.recommendations.map((r, i) => {
                    const [title, ...rest] = r.split(':');
                    return (
                      <li key={i} className="pl-3 border-l-2 border-emerald-200 dark:border-emerald-800">
                        <span className="font-semibold text-ink-900 dark:text-ink-50">{title}:</span>{rest.join(':')}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
