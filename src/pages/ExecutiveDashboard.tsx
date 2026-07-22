import { useMemo, useState, useEffect } from 'react';
import { Wallet, Target, Store, Gauge, Percent, Package } from 'lucide-react';
import TopBar from '../components/TopBar';
import KpiCard from '../components/KpiCard';
import BarChartCard from '../components/charts/BarChartCard';
import LineChartCard from '../components/charts/LineChartCard';
import MultiSelect from '../components/MultiSelect';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import {
  applyFilters, sumNominal, distinctCount, sumTarget, groupSumBy, trendByMonth,
  formatRupiah, formatNumber, safeAverage, distinctMonthsPresent,
  pctChange, depoLabel, bulanLabel, tahunLabel, aoPerSupplier,
} from '../lib/aggregate';
import { MONTH_NAMES_ID, MONTH_NAMES_FULL_ID } from '../lib/types';

export default function ExecutiveDashboard() {
  const { sales, targets, loading, error } = useSalesData();
  const filters = useFilterStore();

  const filtered = useMemo(() => applyFilters(sales, filters), [sales, filters]);

  const totalOmset = useMemo(() => sumNominal(filtered), [filtered]);
  const monthsPresent = useMemo(() => distinctMonthsPresent(filtered), [filtered]);
  const totalTarget = useMemo(
    () => sumTarget(targets, filters.depo, monthsPresent, filters.tahun),
    [targets, filters.depo, monthsPresent, filters.tahun]
  );
  const totalAO = useMemo(() => distinctCount(filtered, 'kdGrup'), [filtered]);
  const avgOmsetPerAO = useMemo(() => safeAverage(totalOmset, totalAO), [totalOmset, totalAO]);
  const pencapaian = totalTarget ? (totalOmset / totalTarget) * 100 : 0;

  const omsetPerKota = useMemo(() => groupSumBy(filtered, 'kota').slice(0, 10), [filtered]);
  const omsetPerDepo = useMemo(() => groupSumBy(filtered, 'depo'), [filtered]);
  // The monthly trend chart always shows every available month regardless of
  // the Bulan filter, so ignore it here (but keep Depo/Tahun in effect).
  const trend = useMemo(() => trendByMonth(applyFilters(sales, { ...filters, bulan: [] })), [sales, filters]);

  // Target vs realisasi per month (respect depo/tahun filter, ignore month filter so the trend is visible)
  const targetVsRealisasi = useMemo(() => {
    const monthlyActual = trendByMonth(applyFilters(sales, { ...filters, bulan: [] }));
    const monthsAvailable = new Set(monthlyActual.map((m) => m.bulan));
    return MONTH_NAMES_ID.slice(0, 12).filter((m) => monthsAvailable.has(m)).map((bulanLbl) => {
      const monthNum = MONTH_NAMES_ID.indexOf(bulanLbl) + 1;
      const realisasi = monthlyActual.find((m) => m.bulan === bulanLbl)?.nominal || 0;
      const target = sumTarget(targets, filters.depo, [monthNum], filters.tahun);
      return { bulan: bulanLbl, Realisasi: realisasi, Target: target };
    });
  }, [sales, targets, filters]);

  // Separate two-year picker for the monthly comparison table below
  const availableYears = useMemo(() => Array.from(new Set(sales.map((r) => r.tahun))).sort(), [sales]);
  const [tahunA, setTahunA] = useState<number | null>(null);
  const [tahunB, setTahunB] = useState<number | null>(null);
  useEffect(() => {
    if (availableYears.length >= 2 && (tahunA === null || tahunB === null)) {
      setTahunA(availableYears[availableYears.length - 2]);
      setTahunB(availableYears[availableYears.length - 1]);
    } else if (availableYears.length === 1 && tahunB === null) {
      setTahunA(availableYears[0]);
      setTahunB(availableYears[0]);
    }
  }, [availableYears, tahunA, tahunB]);

  // The main Bulan filter restricts which months this table shows (empty = all 12).
  const monthsToShow = useMemo(
    () => (filters.bulan.length ? [...filters.bulan].sort((a, b) => a - b) : Array.from({ length: 12 }, (_, i) => i + 1)),
    [filters.bulan]
  );

  const monthlyComparison = useMemo(() => {
    if (tahunA === null || tahunB === null) return { rows: [], grandTotal: null as null | {
      salesA: number; salesB: number; salesGrowth: number | null;
      aoA: number; aoB: number; aoGrowth: number | null;
    } };
    const rowsA = applyFilters(sales, { depo: filters.depo, bulan: [], tahun: [tahunA] });
    const rowsB = applyFilters(sales, { depo: filters.depo, bulan: [], tahun: [tahunB] });
    const rows = monthsToShow.map((monthNum) => {
      const label = MONTH_NAMES_ID[monthNum - 1];
      const aRows = rowsA.filter((r) => r.monthNum === monthNum);
      const bRows = rowsB.filter((r) => r.monthNum === monthNum);
      const salesA = sumNominal(aRows);
      const salesB = sumNominal(bRows);
      const aoA = distinctCount(aRows, 'kdGrup');
      const aoB = distinctCount(bRows, 'kdGrup');
      return {
        bulan: label,
        salesA, salesB,
        salesGrowth: pctChange(salesB, salesA),
        aoA, aoB,
        aoGrowth: pctChange(aoB, aoA),
      };
    });

    // Grand total only covers the months currently shown (respecting the
    // Bulan filter), and AO is a distinct count across that scope rather
    // than a sum of monthly AO (which would double-count outlets active in
    // more than one month).
    const rowsAInScope = rowsA.filter((r) => monthsToShow.includes(r.monthNum));
    const rowsBInScope = rowsB.filter((r) => monthsToShow.includes(r.monthNum));
    const grandSalesA = sumNominal(rowsAInScope);
    const grandSalesB = sumNominal(rowsBInScope);
    const grandAoA = distinctCount(rowsAInScope, 'kdGrup');
    const grandAoB = distinctCount(rowsBInScope, 'kdGrup');

    return {
      rows,
      grandTotal: {
        salesA: grandSalesA, salesB: grandSalesB,
        salesGrowth: pctChange(grandSalesB, grandSalesA),
        aoA: grandAoA, aoB: grandAoB,
        aoGrowth: pctChange(grandAoB, grandAoA),
      },
    };
  }, [sales, filters.depo, monthsToShow, tahunA, tahunB]);

  // --- Tabel AO Persupplier --------------------------------------------
  // Bulan & Tahun here are bound directly to the main sidebar filter store,
  // so changing them here also updates the sidebar (and every other card on
  // this page). Supplier (SUPP) is a local filter scoped to this table only.
  const aoSupplierAll = useMemo(() => aoPerSupplier(filtered), [filtered]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const supplierOptions = useMemo(() => aoSupplierAll.rows.map((r) => r.supplier), [aoSupplierAll]);
  useEffect(() => {
    setSupplierFilter((prev) => prev.filter((s) => supplierOptions.includes(s)));
  }, [supplierOptions]);

  const aoSupplierTable = useMemo(() => {
    if (!supplierFilter.length) return aoSupplierAll;
    const rows = aoSupplierAll.rows.filter((r) => supplierFilter.includes(r.supplier));
    const grandOmset = rows.reduce((a, r) => a + r.omset, 0);
    const grandAO = rows.reduce((a, r) => a + r.ao, 0);
    return { rows, grandTotal: { supplier: 'Grand Total', omset: grandOmset, ao: grandAO } };
  }, [aoSupplierAll, supplierFilter]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <TopBar
        title="Dashboard Kinerja Penjualan & Active Outlet (AO)"
        subtitle={`${depoLabel(filters.depo)} · ${bulanLabel(filters.bulan)} ${tahunLabel(filters.tahun)}`}
      />
      <div id="page-content" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          <KpiCard label="Total Omset" value={formatRupiah(totalOmset)} icon={Wallet} />
          <KpiCard label="Target Omset" value={formatRupiah(totalTarget)} icon={Target} />
          <KpiCard label="Total Active Outlet" value={`${formatNumber(totalAO)} Outlet`} icon={Store} />
          <KpiCard label="Total AO per Supplier" value={`${formatNumber(aoSupplierAll.grandTotal.ao)} AO`} icon={Package} />
          <KpiCard label="Rata-rata Omset / AO" value={formatRupiah(avgOmsetPerAO)} icon={Gauge} />
          <KpiCard
            label="Persentase Pencapaian"
            value={`${pencapaian.toFixed(1)}%`}
            icon={Percent}
            accent={pencapaian >= 100 ? 'brand' : 'ink'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-1">Target vs Realisasi</h3>
            <p className="text-xs text-ink-400 mb-3">Perbandingan target dan pencapaian omset per bulan</p>
            <BarChartCard
              data={targetVsRealisasi}
              xKey="bulan"
              series={[
                { key: 'Target', color: '#d9d9de', name: 'Target' },
                { key: 'Realisasi', color: '#dc2626', name: 'Realisasi' },
              ]}
            />
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm mb-1">Tren Omset Bulanan</h3>
            <p className="text-xs text-ink-400 mb-3">Pergerakan total penjualan sepanjang tahun {tahunLabel(filters.tahun)}</p>
            <LineChartCard
              data={trend.map((t) => ({ bulan: t.bulan, Omset: t.nominal }))}
              xKey="bulan"
              series={[{ key: 'Omset', color: '#dc2626', name: 'Omset' }]}
            />
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm mb-1">Omset per Kota</h3>
            <p className="text-xs text-ink-400 mb-3">10 kota dengan kontribusi penjualan tertinggi</p>
            <BarChartCard
              data={omsetPerKota.map((k) => ({ label: k.label, Omset: k.value }))}
              xKey="label"
              horizontal
              series={[{ key: 'Omset', color: '#ef4444', name: 'Omset' }]}
              height={320}
            />
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm mb-1">Omset per Depo</h3>
            <p className="text-xs text-ink-400 mb-3">Distribusi penjualan di setiap depo</p>
            <BarChartCard
              data={omsetPerDepo.map((k) => ({ label: k.label, Omset: k.value }))}
              xKey="label"
              horizontal
              series={[{ key: 'Omset', color: '#b91c1c', name: 'Omset' }]}
              height={320}
            />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="font-bold text-sm">Tabel Rincian Perbandingan Bulanan</h3>
              <p className="text-xs text-ink-400">
                Perbandingan penjualan & AO antar dua tahun, per bulan{filters.depo.length ? ` · ${depoLabel(filters.depo)}` : ''} · {bulanLabel(filters.bulan)}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Bulan"
                  options={MONTH_NAMES_FULL_ID.map((m, i) => ({ value: String(i + 1), label: m }))}
                  selected={filters.bulan.map(String)}
                  onChange={(v) => filters.setBulan(v.map(Number))}
                  allLabel="Semua Bulan (YTD)"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                Tahun A
                <select
                  value={tahunA ?? ''}
                  onChange={(e) => setTahunA(Number(e.target.value))}
                  className="rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-2 py-1.5"
                >
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                Tahun B
                <select
                  value={tahunB ?? ''}
                  onChange={(e) => setTahunB(Number(e.target.value))}
                  className="rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-2 py-1.5"
                >
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3">Bulan</th>
                  <th className="py-2 pr-3 text-right">Penjualan Tahun {tahunA ?? '-'}</th>
                  <th className="py-2 pr-3 text-right">Penjualan Tahun {tahunB ?? '-'}</th>
                  <th className="py-2 pr-3 text-right">Pertumbuhan Sales (%)</th>
                  <th className="py-2 pr-3 text-right">AO {tahunA ?? '-'}</th>
                  <th className="py-2 pr-3 text-right">AO {tahunB ?? '-'}</th>
                  <th className="py-2 pr-3 text-right">Pertumbuhan AO (%)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyComparison.rows.map((m) => (
                  <tr key={m.bulan} className="border-b border-ink-50 dark:border-ink-800/60">
                    <td className="py-2 pr-3 font-semibold">{m.bulan}</td>
                    <td className="py-2 pr-3 text-right">{formatRupiah(m.salesA)}</td>
                    <td className="py-2 pr-3 text-right">{formatRupiah(m.salesB)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${m.salesGrowth === null ? 'text-ink-400' : m.salesGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {m.salesGrowth === null ? '-' : `${m.salesGrowth >= 0 ? '+' : ''}${m.salesGrowth.toFixed(1)}%`}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatNumber(m.aoA)}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(m.aoB)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${m.aoGrowth === null ? 'text-ink-400' : m.aoGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {m.aoGrowth === null ? '-' : `${m.aoGrowth >= 0 ? '+' : ''}${m.aoGrowth.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {monthlyComparison.grandTotal && (
                  <tr className="border-t-2 border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 font-extrabold">
                    <td className="py-2.5 pr-3">Grand Total</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(monthlyComparison.grandTotal.salesA)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(monthlyComparison.grandTotal.salesB)}</td>
                    <td className={`py-2.5 pr-3 text-right ${monthlyComparison.grandTotal.salesGrowth === null ? 'text-ink-400' : monthlyComparison.grandTotal.salesGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {monthlyComparison.grandTotal.salesGrowth === null ? '-' : `${monthlyComparison.grandTotal.salesGrowth >= 0 ? '+' : ''}${monthlyComparison.grandTotal.salesGrowth.toFixed(1)}%`}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(monthlyComparison.grandTotal.aoA)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(monthlyComparison.grandTotal.aoB)}</td>
                    <td className={`py-2.5 pr-3 text-right ${monthlyComparison.grandTotal.aoGrowth === null ? 'text-ink-400' : monthlyComparison.grandTotal.aoGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {monthlyComparison.grandTotal.aoGrowth === null ? '-' : `${monthlyComparison.grandTotal.aoGrowth >= 0 ? '+' : ''}${monthlyComparison.grandTotal.aoGrowth.toFixed(1)}%`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-sm">AO Persupplier</h3>
              <p className="text-xs text-ink-400">
                Jumlah Active Outlet (AO) &amp; omset per supplier{filters.depo.length ? ` · ${depoLabel(filters.depo)}` : ''} · {bulanLabel(filters.bulan)} · {tahunLabel(filters.tahun)}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-48">
                <MultiSelect
                  label="Supplier"
                  options={supplierOptions.map((s) => ({ value: s, label: s }))}
                  selected={supplierFilter}
                  onChange={setSupplierFilter}
                  allLabel="Semua Supplier"
                />
              </div>
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Bulan"
                  options={MONTH_NAMES_FULL_ID.map((m, i) => ({ value: String(i + 1), label: m }))}
                  selected={filters.bulan.map(String)}
                  onChange={(v) => filters.setBulan(v.map(Number))}
                  allLabel="Semua Bulan (YTD)"
                />
              </div>
              <div className="w-full sm:w-32">
                <MultiSelect
                  label="Tahun"
                  options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
                  selected={filters.tahun.map(String)}
                  onChange={(v) => filters.setTahun(v.map(Number))}
                  allLabel="Semua Tahun"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3 text-right">Omset</th>
                  <th className="py-2 pr-3 text-right">Jumlah AO</th>
                </tr>
              </thead>
              <tbody>
                {aoSupplierTable.rows.map((r) => (
                  <tr key={r.supplier} className="border-b border-ink-50 dark:border-ink-800/60">
                    <td className="py-2 pr-3 font-semibold">{r.supplier}</td>
                    <td className="py-2 pr-3 text-right">{formatRupiah(r.omset)}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(r.ao)}</td>
                  </tr>
                ))}
                {aoSupplierTable.rows.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-ink-400">Tidak ada data untuk filter ini</td></tr>
                )}
                {aoSupplierTable.rows.length > 0 && (
                  <tr className="border-t-2 border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 font-extrabold">
                    <td className="py-2.5 pr-3">Grand Total</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(aoSupplierTable.grandTotal.omset)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(aoSupplierTable.grandTotal.ao)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-ink-400 mt-3">
            AO dihitung per kombinasi Supplier &amp; KD Grup (satu pelanggan bisa terhitung AO di lebih dari satu supplier).
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center h-[70vh] text-sm text-ink-400 font-medium">
      Memuat data dari repository...
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[70vh]">
      <div className="card p-6 max-w-md text-center">
        <p className="font-bold text-brand-600 mb-2">Gagal memuat data</p>
        <p className="text-sm text-ink-500">{message}</p>
      </div>
    </div>
  );
}
