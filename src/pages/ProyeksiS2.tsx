import { useMemo, useState } from 'react';
import TopBar from '../components/TopBar';
import LineChartCard from '../components/charts/LineChartCard';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import { applyFilters, formatRupiah } from '../lib/aggregate';
import { MONTH_NAMES_ID } from '../lib/types';
import { LoadingState, ErrorState } from './ExecutiveDashboard';

type Scenario = 'historis' | 'flat' | 'target5' | 'target10' | 'custom';
type Semester = 1 | 2;

export default function ProyeksiS2() {
  const { sales, loading, error } = useSalesData();
  const filters = useFilterStore();
  const [semester, setSemester] = useState<Semester>(2);
  const [scenario, setScenario] = useState<Scenario>('historis');
  const [customGrowth, setCustomGrowth] = useState(0);

  const monthRange = semester === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  const semesterLabel = semester === 1 ? 'Semester 1' : 'Semester 2';

  const depoFiltered = useMemo(
    () => sales.filter((r) => filters.depo === 'ALL' || r.depo === filters.depo),
    [sales, filters.depo]
  );

  function monthlyTotalsFor(year: number) {
    const rows = applyFilters(depoFiltered, { depo: 'ALL', bulan: 0, tahun: year })
      .filter((r) => monthRange.includes(r.monthNum));
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.monthNum, (map.get(r.monthNum) || 0) + r.nominal);
    return monthRange.map((m) => map.get(m) || 0);
  }

  // Baseline: actual figures for the same semester one year before the target year.
  const baselineMonthly = useMemo(() => monthlyTotalsFor(filters.tahun - 1), [depoFiltered, filters.tahun, semester]);
  const baselineTotal = baselineMonthly.reduce((a, b) => a + b, 0);

  // Historical growth trend: how that same semester grew year-over-year the last time
  // both years were fully known (year-2 -> year-1). Works the same whether we're
  // projecting Semester 1 or Semester 2.
  const priorMonthly = useMemo(() => monthlyTotalsFor(filters.tahun - 2), [depoFiltered, filters.tahun, semester]);
  const priorTotal = priorMonthly.reduce((a, b) => a + b, 0);
  const historicalGrowthPct = priorTotal ? ((baselineTotal - priorTotal) / priorTotal) * 100 : 0;

  const effectiveGrowth = useMemo(() => {
    switch (scenario) {
      case 'historis': return historicalGrowthPct;
      case 'flat': return 0;
      case 'target5': return 5;
      case 'target10': return 10;
      case 'custom': return customGrowth;
    }
  }, [scenario, historicalGrowthPct, customGrowth]);

  const projectedMonthly = baselineMonthly.map((v) => v * (1 + effectiveGrowth / 100));
  const projectedTotal = projectedMonthly.reduce((a, b) => a + b, 0);
  const selisih = projectedTotal - baselineTotal;

  const chartData = monthRange.map((m, i) => ({
    bulan: MONTH_NAMES_ID[m - 1],
    [`Realisasi ${filters.tahun - 1}`]: baselineMonthly[i],
    [`Proyeksi ${filters.tahun}`]: Math.round(projectedMonthly[i]),
  }));

  const SCENARIOS: { id: Scenario; label: string }[] = [
    { id: 'historis', label: `Tren Historis (${historicalGrowthPct >= 0 ? '+' : ''}${historicalGrowthPct.toFixed(2)}%)` },
    { id: 'flat', label: 'Flat (0.00%)' },
    { id: 'target5', label: 'Target (+5.00%)' },
    { id: 'target10', label: 'Target (+10.00%)' },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <TopBar title={`Proyeksi ${semesterLabel} ${filters.tahun}`} subtitle={filters.depo === 'ALL' ? 'Semua Depo' : filters.depo} />
      <div id="page-content" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-sm mb-1">Pengaturan Proyeksi {semesterLabel} ({filters.tahun})</h3>
              <p className="text-xs text-ink-400">Pilih skenario atau atur target pertumbuhan penjualan secara kustom.</p>
            </div>
            <div className="flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden shrink-0">
              {([1, 2] as Semester[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSemester(s)}
                  className={`px-4 py-2 text-xs font-bold transition-colors ${
                    semester === s
                      ? 'bg-brand-600 text-white'
                      : 'bg-white dark:bg-ink-900 text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800'
                  }`}
                >
                  Semester {s}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-ink-500 mb-2">Skenario Instan</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  scenario === s.id
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-ink-500 mb-2">
            Tingkat Pertumbuhan Kustom {scenario === 'custom' ? `${customGrowth >= 0 ? '+' : ''}${customGrowth.toFixed(2)}%` : ''}
          </p>
          <input
            type="range"
            min={-20}
            max={20}
            step={0.5}
            value={customGrowth}
            onChange={(e) => { setCustomGrowth(Number(e.target.value)); setScenario('custom'); }}
            className="w-full accent-brand-600 mb-1"
          />
          <div className="flex justify-between text-[11px] text-ink-400 font-medium mb-5">
            <span>-20% (Pesimis)</span><span>0% (Flat)</span><span>+20% (Optimis)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-4">
              <p className="text-xs font-semibold text-ink-400 mb-1">Realisasi {semesterLabel} {filters.tahun - 1}</p>
              <p className="text-lg font-extrabold">{formatRupiah(baselineTotal)}</p>
            </div>
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 p-4">
              <p className="text-xs font-semibold text-brand-600 mb-1">Proyeksi {semesterLabel} {filters.tahun}</p>
              <p className="text-lg font-extrabold text-brand-700 dark:text-brand-400">{formatRupiah(projectedTotal)}</p>
            </div>
            <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-4">
              <p className="text-xs font-semibold text-ink-400 mb-1">Estimasi Selisih</p>
              <p className={`text-lg font-extrabold ${selisih >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                {selisih >= 0 ? '+' : ''}{formatRupiah(selisih)}
              </p>
            </div>
          </div>
          {baselineTotal === 0 && (
            <p className="text-xs text-ink-400 mt-3">
              * Data realisasi {semesterLabel} {filters.tahun - 1} belum tersedia di file data omset untuk filter yang dipilih.
            </p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-sm mb-1">Grafik Tren Penjualan {semesterLabel} ({filters.tahun - 1} vs {filters.tahun} Proyeksi)</h3>
          <p className="text-xs text-ink-400 mb-3">
            Membandingkan realisasi {MONTH_NAMES_ID[monthRange[0] - 1]} - {MONTH_NAMES_ID[monthRange[monthRange.length - 1] - 1]} {filters.tahun - 1} dengan proyeksi {MONTH_NAMES_ID[monthRange[0] - 1]} - {MONTH_NAMES_ID[monthRange[monthRange.length - 1] - 1]} {filters.tahun}
          </p>
          <LineChartCard
            data={chartData}
            xKey="bulan"
            series={[
              { key: `Realisasi ${filters.tahun - 1}`, color: '#b5b5bd', name: `Realisasi ${filters.tahun - 1}` },
              { key: `Proyeksi ${filters.tahun}`, color: '#dc2626', name: `Proyeksi ${filters.tahun}`, dashed: true },
            ]}
          />
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-sm mb-1">Rincian Bulanan Proyeksi {semesterLabel} ({filters.tahun} vs {filters.tahun - 1})</h3>
          <p className="text-xs text-ink-400 mb-3">
            Mencakup bulan {MONTH_NAMES_ID[monthRange[0] - 1]} hingga {MONTH_NAMES_ID[monthRange[monthRange.length - 1] - 1]}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3">Bulan</th>
                  <th className="py-2 pr-3 text-right">Penjualan Aktual {filters.tahun - 1}</th>
                  <th className="py-2 pr-3 text-right">Penjualan Proyeksi {filters.tahun}</th>
                  <th className="py-2 pr-3 text-right">Selisih Nominal (Rp)</th>
                  <th className="py-2 pr-3 text-right">Persentase Perubahan (%)</th>
                </tr>
              </thead>
              <tbody>
                {monthRange.map((m, i) => {
                  const actual = baselineMonthly[i];
                  const proj = projectedMonthly[i];
                  const diff = proj - actual;
                  const pct = actual ? (diff / actual) * 100 : 0;
                  return (
                    <tr key={m} className="border-b border-ink-50 dark:border-ink-800/60">
                      <td className="py-2 pr-3 font-semibold">{MONTH_NAMES_ID[m - 1]}</td>
                      <td className="py-2 pr-3 text-right">{formatRupiah(actual)}</td>
                      <td className="py-2 pr-3 text-right">{formatRupiah(proj)}</td>
                      <td className={`py-2 pr-3 text-right ${diff >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                        {diff >= 0 ? '+' : ''}{formatRupiah(diff)}
                      </td>
                      <td className="py-2 pr-3 text-right">{actual ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '-'}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold border-t-2 border-ink-200 dark:border-ink-700">
                  <td className="py-2 pr-3">TOTAL {semesterLabel.toUpperCase()}</td>
                  <td className="py-2 pr-3 text-right">{formatRupiah(baselineTotal)}</td>
                  <td className="py-2 pr-3 text-right">{formatRupiah(projectedTotal)}</td>
                  <td className={`py-2 pr-3 text-right ${selisih >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                    {selisih >= 0 ? '+' : ''}{formatRupiah(selisih)}
                  </td>
                  <td className="py-2 pr-3 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
