import { useMemo, useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import KpiCard from '../components/KpiCard';
import BarChartCard from '../components/charts/BarChartCard';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import {
  applyFilters, salesByDSR, avgMonthlyAOByDSR, telemarketingContribution,
  supplierBreakdownForDSR, formatRupiah, formatNumber, sumNominal,
} from '../lib/aggregate';
import { MONTH_NAMES_ID } from '../lib/types';
import { LoadingState, ErrorState } from './ExecutiveDashboard';
import { Phone, Search, Crown } from 'lucide-react';

export default function KinerjaDSR() {
  const { sales, loading, error } = useSalesData();
  const filters = useFilterStore();
  const filtered = useMemo(() => applyFilters(sales, filters), [sales, filters]);

  const ranking = useMemo(() => salesByDSR(filtered), [filtered]);
  const avgAO = useMemo(() => avgMonthlyAOByDSR(filtered), [filtered]);
  const totalOmsetAll = useMemo(() => sumNominal(filtered), [filtered]);

  const dsrTeraktif = ranking[0] ?? null;
  const dsrTeraktifShare = dsrTeraktif && totalOmsetAll ? (dsrTeraktif.nominal / totalOmsetAll) * 100 : 0;

  const [search, setSearch] = useState('');
  const filteredRanking = useMemo(
    () => ranking.filter((r) => r.dsr.toLowerCase().includes(search.trim().toLowerCase())),
    [ranking, search]
  );

  const [selectedDSR, setSelectedDSR] = useState<string | null>(null);
  useEffect(() => {
    if (ranking.length && (!selectedDSR || !ranking.find((r) => r.dsr === selectedDSR))) {
      setSelectedDSR(ranking[0].dsr);
    }
    if (!ranking.length) setSelectedDSR(null);
  }, [ranking, selectedDSR]);

  const dsrRows = useMemo(
    () => (selectedDSR ? filtered.filter((r) => r.sales === selectedDSR) : []),
    [filtered, selectedDSR]
  );
  const dsrTotal = useMemo(() => dsrRows.reduce((a, r) => a + r.nominal, 0), [dsrRows]);
  const dsrAvgAO = useMemo(() => avgAO.find((a) => a.dsr === selectedDSR)?.avgAo ?? 0, [avgAO, selectedDSR]);
  const teleContribution = useMemo(() => telemarketingContribution(dsrRows), [dsrRows]);
  const supplierBreakdown = useMemo(
    () => (selectedDSR ? supplierBreakdownForDSR(filtered, selectedDSR) : []),
    [filtered, selectedDSR]
  );

  const periodLabel = filters.bulan === 0
    ? `Januari - ${MONTH_NAMES_ID[Math.max(...filtered.map((r) => r.monthNum), 1) - 1] || 'Juni'} ${filters.tahun}`
    : `${MONTH_NAMES_ID[filters.bulan - 1]} ${filters.tahun}`;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <TopBar title="Kinerja DSR" subtitle={`${filters.depo === 'ALL' ? 'Semua Depo' : filters.depo} · Periode ${periodLabel}`} />
      <div id="page-content" className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="DSR Teraktif"
            value={dsrTeraktif ? dsrTeraktif.dsr : '-'}
            icon={Crown}
            sub={dsrTeraktif ? `${formatRupiah(dsrTeraktif.nominal)} · ${dsrTeraktifShare.toFixed(1)}% dari total omset` : undefined}
          />
          <KpiCard label="Jumlah DSR Aktif" value={`${formatNumber(ranking.length)} DSR`} />
          <KpiCard label="Total Omset Semua DSR" value={formatRupiah(totalOmsetAll)} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-1">Peringkat Penjualan DSR</h3>
            <p className="text-xs text-ink-400 mb-3">Total Penjualan DSR Periode {periodLabel} (Aktual)</p>
            <BarChartCard
              data={ranking.map((r) => ({ dsr: r.dsr, Omset: r.nominal }))}
              xKey="dsr"
              horizontal
              height={Math.max(260, ranking.length * 28)}
              series={[{ key: 'Omset', color: '#dc2626', name: 'Omset' }]}
            />
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm mb-1">Rata-rata Outlet Aktif (AO) DSR</h3>
            <p className="text-xs text-ink-400 mb-3">Rata-rata Bulanan Outlet Unik Terlayani per DSR</p>
            <BarChartCard
              data={avgAO.map((r) => ({ dsr: r.dsr, AO: r.avgAo }))}
              xKey="dsr"
              horizontal
              height={Math.max(260, avgAO.length * 28)}
              valueFormatter={(v) => `${formatNumber(v)} outlet`}
              series={[{ key: 'AO', color: '#b91c1c', name: 'Rata-rata AO' }]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-3">Daftar DSR</h3>
            <p className="text-xs text-ink-400 mb-3">Pilih salah satu DSR untuk melihat breakdown per supplier</p>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama DSR..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
              {filteredRanking.map((r) => (
                <button
                  key={r.dsr}
                  onClick={() => setSelectedDSR(r.dsr)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-between transition-colors ${
                    selectedDSR === r.dsr
                      ? 'bg-brand-600 text-white'
                      : 'hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300'
                  }`}
                >
                  <span className="truncate">{r.dsr}</span>
                </button>
              ))}
              {filteredRanking.length === 0 && (
                <p className="text-xs text-ink-400 text-center py-4">Tidak ada DSR dengan nama tersebut</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div>
                <h3 className="font-bold text-sm">Distribusi Produk / Supplier DSR</h3>
                <p className="text-xs text-ink-400">Breakdown Penjualan DSR Terpilih di {filters.tahun} YTD</p>
                <p className="text-lg font-extrabold mt-1">DSR: {selectedDSR ?? '-'}</p>
              </div>

              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-xs text-ink-400 font-semibold">Total Sales ({periodLabel})</p>
                  <p className="text-xl font-extrabold text-brand-600">{formatRupiah(dsrTotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400 font-semibold">Rata-rata AO Bulanan</p>
                  <p className="text-xl font-extrabold">{formatNumber(dsrAvgAO)} Outlet</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 text-xs font-semibold w-fit">
              <Phone size={14} /> Kontribusi Omset Telemarketing: {formatRupiah(teleContribution)}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                    <th className="py-2 pr-3">Nama Brand / Supplier</th>
                    <th className="py-2 pr-3 text-right">Penjualan {filters.tahun} (YTD)</th>
                    <th className="py-2 pr-3 text-right">Porsi (%)</th>
                    <th className="py-2 pr-3 text-right">Rata-rata AO</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierBreakdown.map((s) => (
                    <tr key={s.supplier} className="border-b border-ink-50 dark:border-ink-800/60">
                      <td className="py-2 pr-3 font-semibold">{s.supplier}</td>
                      <td className="py-2 pr-3 text-right">{formatRupiah(s.nominal)}</td>
                      <td className="py-2 pr-3 text-right">{s.porsi.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right">{formatNumber(s.avgAo)}</td>
                    </tr>
                  ))}
                  {supplierBreakdown.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-ink-400">Tidak ada data untuk filter ini</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
