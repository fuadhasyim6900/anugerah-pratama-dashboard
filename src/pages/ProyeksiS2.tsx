import { useMemo, useState } from 'react';
import TopBar from '../components/TopBar';
import LineChartCard from '../components/charts/LineChartCard';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import { applyFilters, formatRupiah, depoLabel, primaryYear } from '../lib/aggregate';
import { MONTH_NAMES_ID } from '../lib/types';
import { LoadingState, ErrorState } from './ExecutiveDashboard';

type Scenario = 'historis' | 'flat' | 'target5' | 'target10' | 'custom';
type PeriodId = 'S1' | 'S2' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

const PERIOD_DEFS: Record<PeriodId, { label: string; months: number[] }> = {
  S1: { label: 'Semester 1', months: [1, 2, 3, 4, 5, 6] },
  S2: { label: 'Semester 2', months: [7, 8, 9, 10, 11, 12] },
  Q1: { label: 'Kuartal 1', months: [1, 2, 3] },
  Q2: { label: 'Kuartal 2', months: [4, 5, 6] },
  Q3: { label: 'Kuartal 3', months: [7, 8, 9] },
  Q4: { label: 'Kuartal 4', months: [10, 11, 12] },
};

export default function ProyeksiS2() {
  const { sales, loading, error } = useSalesData();
  const filters = useFilterStore();
  const [period, setPeriod] = useState<PeriodId>('S2');
  const [scenario, setScenario] = useState<Scenario>('historis');
  const [customGrowth, setCustomGrowth] = useState(0);

  const availableYears = useMemo(() => Array.from(new Set(sales.map((r) => r.tahun))).sort(), [sales]);
  // Multiple years can be selected in the sidebar; projections need one
  // reference year, so use the most recently selected one (or the latest
  // year in the data if none is selected).
  const currentYear = useMemo(() => primaryYear(filters.tahun, availableYears), [filters.tahun, availableYears]);

  const monthRange = PERIOD_DEFS[period].months;
  const periodLabel = PERIOD_DEFS[period].label;

  const depoFiltered = useMemo(
    () => sales.filter((r) => filters.depo.length === 0 || filters.depo.includes(r.depo)),
    [sales, filters.depo]
  );

  function monthlyTotalsFor(year: number) {
    const rows = applyFilters(depoFiltered, { depo: [], bulan: [], tahun: [year] })
      .filter((r) => monthRange.includes(r.monthNum));
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.monthNum, (map.get(r.monthNum) || 0) + r.nominal);
    return monthRange.map((m) => map.get(m) || 0);
  }

  // Baseline: actual figures for the same period one year before the target year.
  const baselineMonthly = useMemo(() => monthlyTotalsFor(currentYear - 1), [depoFiltered, currentYear, period]);
  const baselineTotal = baselineMonthly.reduce((a, b) => a + b, 0);

  // Historical growth trend: how that same period grew year-over-year the last time
  // both years were fully known (year-2 -> year-1). Works for any semester/quarter.
  const priorMonthly = useMemo(() => monthlyTotalsFor(currentYear - 2), [depoFiltered, currentYear, period]);
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
    [`Realisasi ${currentYear - 1}`]: baselineMonthly[i],
    [`Proyeksi ${currentYear}`]: Math.round(projectedMonthly[i]),
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
      <TopBar title={`Proyeksi ${periodLabel} ${currentYear}`} subtitle={depoLabel(filters.depo)} />
      <div id="page-content" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-sm mb-1">Pengaturan Proyeksi {periodLabel} ({currentYear})</h3>
              <p className="text-xs text-ink-400">Pilih skenario atau atur target pertumbuhan penjualan secara kustom.</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wide w-14 shrink-0">Semester</span>
                <div className="flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
                  {(['S1', 'S2'] as PeriodId[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                        period === p
                          ? 'bg-brand-600 text-white'
                          : 'bg-white dark:bg-ink-900 text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800'
                      }`}
                    >
                      {PERIOD_DEFS[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wide w-14 shrink-0">Kuartal</span>
                <div className="flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as PeriodId[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                        period === p
                          ? 'bg-brand-600 text-white'
                          : 'bg-white dark:bg-ink-900 text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
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
              <p className="text-xs font-semibold text-ink-400 mb-1">Realisasi {periodLabel} {currentYear - 1}</p>
              <p className="text-lg font-extrabold">{formatRupiah(baselineTotal)}</p>
            </div>
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 p-4">
              <p className="text-xs font-semibold text-brand-600 mb-1">Proyeksi {periodLabel} {currentYear}</p>
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
              * Data realisasi {periodLabel} {currentYear - 1} belum tersedia di file data omset untuk filter yang dipilih.
            </p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-sm mb-1">Grafik Tren Penjualan {periodLabel} ({currentYear - 1} vs {currentYear} Proyeksi)</h3>
          <p className="text-xs text-ink-400 mb-3">
            Membandingkan realisasi {MONTH_NAMES_ID[monthRange[0] - 1]} - {MONTH_NAMES_ID[monthRange[monthRange.length - 1] - 1]} {currentYear - 1} dengan proyeksi {MONTH_NAMES_ID[monthRange[0] - 1]} - {MONTH_NAMES_ID[monthRange[monthRange.length - 1] - 1]} {currentYear}
          </p>
          <LineChartCard
            data={chartData}
            xKey="bulan"
            series={[
              { key: `Realisasi ${currentYear - 1}`, color: '#b5b5bd', name: `Realisasi ${currentYear - 1}` },
              { key: `Proyeksi ${currentYear}`, color: '#dc2626', name: `Proyeksi ${currentYear}`, dashed: true },
            ]}
          />
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-sm mb-1">Rincian Bulanan Proyeksi {periodLabel} ({currentYear} vs {currentYear - 1})</h3>
          <p className="text-xs text-ink-400 mb-3">
            Mencakup bulan {MONTH_NAMES_ID[monthRange[0] - 1]} hingga {MONTH_NAMES_ID[monthRange[monthRange.length - 1] - 1]}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3">Bulan</th>
                  <th className="py-2 pr-3 text-right">Penjualan Aktual {currentYear - 1}</th>
                  <th className="py-2 pr-3 text-right">Penjualan Proyeksi {currentYear}</th>
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
                  <td className="py-2 pr-3">TOTAL {periodLabel.toUpperCase()}</td>
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
