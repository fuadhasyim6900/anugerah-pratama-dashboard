import { useMemo, useState, useEffect, useRef } from 'react';
import { Wallet, Target, Store, Gauge, Percent, Package, Map, TrendingUp, Users2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import KpiCard from '../components/KpiCard';
import BarChartCard from '../components/charts/BarChartCard';
import ComboChartCard from '../components/charts/ComboChartCard';
import MultiSelect from '../components/MultiSelect';
import ExportMenu from '../components/ExportMenu';
import Tabs, { TabPanel } from '../components/Tabs';
import DetailModal from '../components/DetailModal';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import {
  applyFilters, sumNominal, distinctCount, sumTarget, groupSumBy, trendByMonth,
  formatRupiah, formatNumber, safeAverage, distinctMonthsPresent,
  depoLabel, bulanLabel, tahunLabel, aoPerSupplier, dsrRankingBySupplier,
} from '../lib/aggregate';
import { MONTH_NAMES_ID, MONTH_NAMES_FULL_ID } from '../lib/types';

const EXEC_TABS = [
  { id: 'wilayah', label: 'Distribusi Wilayah', icon: <Map size={14} />, sectionIds: ['sec-omset-per-kota', 'sec-omset-per-depo'] },
  { id: 'target', label: 'Target vs Realisasi', icon: <TrendingUp size={14} />, sectionIds: ['sec-target-vs-realisasi'] },
  { id: 'supplier', label: 'AO Supplier', icon: <Users2 size={14} />, sectionIds: ['sec-ao-persupplier'] },
];

export default function ExecutiveDashboard() {
  const { sales, targets, loading, error } = useSalesData();
  const availableYears = useMemo(() => Array.from(new Set(sales.map((r) => r.tahun))).sort(), [sales]);
  const filters = useFilterStore();

  const filtered = useMemo(() => applyFilters(sales, filters), [sales, filters]);

  const totalOmset = useMemo(() => sumNominal(filtered), [filtered]);
  const monthsPresent = useMemo(() => distinctMonthsPresent(filtered), [filtered]);
  const totalTarget = useMemo(
    () => sumTarget(targets, filters.depo, monthsPresent, filters.tahun, filters.dsr, filters.supp),
    [targets, filters.depo, monthsPresent, filters.tahun, filters.dsr, filters.supp]
  );
  const totalAO = useMemo(() => distinctCount(filtered, 'kdGrup'), [filtered]);
  const avgOmsetPerAO = useMemo(() => safeAverage(totalOmset, totalAO), [totalOmset, totalAO]);
  const pencapaian = totalTarget ? (totalOmset / totalTarget) * 100 : 0;

  const omsetPerKota = useMemo(() => groupSumBy(filtered, 'kota').slice(0, 10), [filtered]);
  // Local Supplier filter scoped to the "Omset per Depo" chart only (same pattern as
  // AO Persupplier / Ranking DSR per Supplier), on top of the main sidebar filters.
  const omsetPerDepoSuppOptions = useMemo(
    () => Array.from(new Set(filtered.map((r) => r.supp).filter(Boolean))).sort(),
    [filtered]
  );
  const [omsetPerDepoSupp, setOmsetPerDepoSupp] = useState<string[]>([]);
  useEffect(() => {
    setOmsetPerDepoSupp((prev) => prev.filter((s) => omsetPerDepoSuppOptions.includes(s)));
  }, [omsetPerDepoSuppOptions]);
  const omsetPerDepoRows = useMemo(
    () => (omsetPerDepoSupp.length ? filtered.filter((r) => omsetPerDepoSupp.includes(r.supp)) : filtered),
    [filtered, omsetPerDepoSupp]
  );
  // Target lookup should follow the same effective supplier scope: the local filter
  // when set, otherwise fall back to whatever the main sidebar Supplier filter is.
  const omsetPerDepoEffectiveSupp = omsetPerDepoSupp.length ? omsetPerDepoSupp : filters.supp;
  const omsetPerDepo = useMemo(() => groupSumBy(omsetPerDepoRows, 'depo'), [omsetPerDepoRows]);
  // Target per depo, matched to each depo's own Omset bar above, so the
  // "Omset per Depo" chart can show Target alongside Realisasi/Omset.
  const omsetPerDepoWithTarget = useMemo(
    () => omsetPerDepo.map((d) => ({
      label: d.label,
      Omset: d.value,
      Target: sumTarget(targets, [d.label], monthsPresent, filters.tahun, filters.dsr, omsetPerDepoEffectiveSupp),
    })),
    [omsetPerDepo, targets, monthsPresent, filters.tahun, filters.dsr, omsetPerDepoEffectiveSupp]
  );
  // Always the grand total across every depo for the selected Bulan/Tahun —
  // intentionally ignores the Depo filter itself, so picking e.g. "Jepara"
  // still shows the total for all depo, not just Jepara's own number. Uses
  // the same effective supplier scope as the chart below it (local filter
  // when set, otherwise the main sidebar Supplier filter).
  const omsetPerDepoTotal = useMemo(
    () => sumNominal(applyFilters(sales, { ...filters, depo: [], supp: omsetPerDepoEffectiveSupp })),
    [sales, filters, omsetPerDepoEffectiveSupp]
  );
  // Target vs realisasi per month (respect depo/tahun filter, ignore month filter so the trend is
  // visible). "Omset" mirrors "Realisasi" and is drawn as a line on top of the bars so the chart
  // reads as a combo chart (bars for Target/Realisasi, line for the Omset trend and a second line
  // for the Target trend), replacing the separate "Tren Omset Bulanan" line chart that used to sit
  // next to it.
  const targetVsRealisasi = useMemo(() => {
    const monthlyActual = trendByMonth(applyFilters(sales, { ...filters, bulan: [] }));
    const monthsAvailable = new Set(monthlyActual.map((m) => m.bulan));
    return MONTH_NAMES_ID.slice(0, 12).filter((m) => monthsAvailable.has(m)).map((bulanLbl) => {
      const monthNum = MONTH_NAMES_ID.indexOf(bulanLbl) + 1;
      const realisasi = monthlyActual.find((m) => m.bulan === bulanLbl)?.nominal || 0;
      const target = sumTarget(targets, filters.depo, [monthNum], filters.tahun, filters.dsr, filters.supp);
      return { bulan: bulanLbl, Realisasi: realisasi, Target: target, Omset: realisasi };
    });
  }, [sales, targets, filters]);

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

  const targetVsRealisasiRef = useRef<HTMLDivElement>(null);
  const omsetPerKotaRef = useRef<HTMLDivElement>(null);
  const omsetPerDepoRef = useRef<HTMLDivElement>(null);
  const aoSupplierRef = useRef<HTMLDivElement>(null);

  // --- Drill-down modals (click a bar/row to "mengerucutkan" ke satu item) --
  const [kotaDetail, setKotaDetail] = useState<string | null>(null);
  const kotaDetailData = useMemo(() => {
    if (!kotaDetail) return null;
    const rows = filtered.filter((r) => r.kota === kotaDetail);
    return {
      total: sumNominal(rows),
      ao: distinctCount(rows, 'kdGrup'),
      trend: trendByMonth(rows),
      byDepo: groupSumBy(rows, 'depo'),
    };
  }, [kotaDetail, filtered]);

  const [depoDetail, setDepoDetail] = useState<string | null>(null);
  const depoDetailData = useMemo(() => {
    if (!depoDetail) return null;
    const rows = omsetPerDepoRows.filter((r) => r.depo === depoDetail);
    const target = omsetPerDepoWithTarget.find((d) => d.label === depoDetail)?.Target || 0;
    return {
      total: sumNominal(rows),
      ao: distinctCount(rows, 'kdGrup'),
      target,
      topKota: groupSumBy(rows, 'kota').slice(0, 5),
    };
  }, [depoDetail, omsetPerDepoRows, omsetPerDepoWithTarget]);

  const [suppDetail, setSuppDetail] = useState<string | null>(null);
  const suppDetailData = useMemo(() => {
    if (!suppDetail) return null;
    const rows = filtered.filter((r) => r.supp === suppDetail);
    // Ranking penuh (tidak dipotong 8) — bisa digulir di dalam popup.
    return dsrRankingBySupplier(rows).rows;
  }, [suppDetail, filtered]);

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

        <Tabs tabs={EXEC_TABS} storageKey="executive-dashboard">
        <TabPanel id="wilayah">
        <div className="grid grid-cols-1 gap-6">
          <div id="sec-omset-per-kota" className="card p-5 scroll-mt-28" ref={omsetPerKotaRef}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="font-bold text-sm">Omset per Kota</h3>
              <ExportMenu targetRef={omsetPerKotaRef} filename="omset-per-kota" />
            </div>
            <p className="text-xs text-ink-400 mb-3">10 kota dengan kontribusi penjualan tertinggi · klik salah satu bar untuk rincian</p>
            <BarChartCard
              data={omsetPerKota.map((k) => ({ label: k.label, Omset: k.value }))}
              xKey="label"
              series={[{ key: 'Omset', color: '#2563eb', name: 'Omset' }]}
              height={320}
              onItemClick={setKotaDetail}
            />
          </div>

          <div id="sec-omset-per-depo" className="card p-5 scroll-mt-28" ref={omsetPerDepoRef}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
              <h3 className="font-bold text-sm">Omset per Depo</h3>
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <MultiSelect
                    label="Supplier"
                    options={omsetPerDepoSuppOptions.map((s) => ({ value: s, label: s }))}
                    selected={omsetPerDepoSupp}
                    onChange={setOmsetPerDepoSupp}
                    allLabel="Semua Supplier"
                  />
                </div>
                <ExportMenu targetRef={omsetPerDepoRef} filename="omset-per-depo" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs text-ink-400">
                Distribusi penjualan di setiap depo, dengan Target masing-masing depo{omsetPerDepoSupp.length ? ` · ${omsetPerDepoSupp.join(', ')}` : ''}
              </p>
              <p className="text-xs font-bold text-brand-600 whitespace-nowrap">
                Total Semua Depo: {formatRupiah(omsetPerDepoTotal)}
              </p>
            </div>
            <BarChartCard
              data={omsetPerDepoWithTarget}
              xKey="label"
              series={[
                { key: 'Target', color: '#d9d9de', name: 'Target' },
                { key: 'Omset', color: '#b91c1c', name: 'Omset' },
              ]}
              pctLabel={{ valueKey: 'Omset', targetKey: 'Target' }}
              height={320}
              onItemClick={setDepoDetail}
            />
          </div>
        </div>
        </TabPanel>

        <TabPanel id="target">
        <div id="sec-target-vs-realisasi" className="card p-5 scroll-mt-28" ref={targetVsRealisasiRef}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-bold text-sm">Target vs Realisasi</h3>
            <ExportMenu targetRef={targetVsRealisasiRef} filename="target-vs-realisasi" />
          </div>
          <p className="text-xs text-ink-400 mb-3">
            Perbandingan target dan pencapaian omset per bulan, dengan garis tren Target dan Omset Bulanan
          </p>
          <ComboChartCard
            data={targetVsRealisasi}
            xKey="bulan"
            bars={[
              { key: 'Target', color: '#d9d9de', name: 'Target' },
              { key: 'Realisasi', color: '#b91c1c', name: 'Realisasi' },
            ]}
            lines={[
              { key: 'Target', color: '#16a34a', name: 'Target (Tren)', dashed: true },
              { key: 'Omset', color: '#2563eb', name: 'Omset' },
            ]}
            pctLabel={{ valueKey: 'Realisasi', targetKey: 'Target' }}
          />
        </div>
        </TabPanel>

        <TabPanel id="supplier">
        <div id="sec-ao-persupplier" className="card p-5 scroll-mt-28" ref={aoSupplierRef}>
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
              <ExportMenu targetRef={aoSupplierRef} filename="ao-persupplier" />
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
                  <tr
                    key={r.supplier}
                    onClick={() => setSuppDetail(r.supplier)}
                    className="border-b border-ink-50 dark:border-ink-800/60 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/60"
                  >
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
            AO dihitung per kombinasi Supplier &amp; KD Grup (satu pelanggan bisa terhitung AO di lebih dari satu supplier). Klik salah satu baris untuk melihat ranking DSR di supplier tersebut.
          </p>
        </div>
        </TabPanel>

        </Tabs>

      </div>

      <DetailModal
        open={!!kotaDetail}
        onClose={() => setKotaDetail(null)}
        title={`Rincian Kota: ${kotaDetail ?? ''}`}
        subtitle={`${depoLabel(filters.depo)} · ${bulanLabel(filters.bulan)} ${tahunLabel(filters.tahun)}`}
      >
        {kotaDetailData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                <p className="text-[11px] text-ink-400 font-semibold">Total Omset</p>
                <p className="text-lg font-extrabold text-brand-600">{formatRupiah(kotaDetailData.total)}</p>
              </div>
              <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                <p className="text-[11px] text-ink-400 font-semibold">Total AO</p>
                <p className="text-lg font-extrabold">{formatNumber(kotaDetailData.ao)} Outlet</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold mb-2">Distribusi per Depo</p>
              <div className="space-y-1">
                {kotaDetailData.byDepo.map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm py-1 border-b border-ink-50 dark:border-ink-800/60">
                    <span className="font-medium">{d.label}</span>
                    <span className="font-semibold">{formatRupiah(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold mb-2">Tren Bulanan</p>
              <div className="space-y-1">
                {kotaDetailData.trend.map((t) => (
                  <div key={t.bulan} className="flex items-center justify-between text-sm py-1 border-b border-ink-50 dark:border-ink-800/60">
                    <span className="font-medium">{t.bulan}</span>
                    <span className="font-semibold">{formatRupiah(t.nominal)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={!!depoDetail}
        onClose={() => setDepoDetail(null)}
        title={`Rincian Depo: ${depoDetail ?? ''}`}
        subtitle={`${bulanLabel(filters.bulan)} ${tahunLabel(filters.tahun)}${omsetPerDepoSupp.length ? ` · ${omsetPerDepoSupp.join(', ')}` : ''}`}
      >
        {depoDetailData && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                <p className="text-[11px] text-ink-400 font-semibold">Omset</p>
                <p className="text-base font-extrabold text-brand-600">{formatRupiah(depoDetailData.total)}</p>
              </div>
              <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                <p className="text-[11px] text-ink-400 font-semibold">Target</p>
                <p className="text-base font-extrabold">{formatRupiah(depoDetailData.target)}</p>
              </div>
              <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                <p className="text-[11px] text-ink-400 font-semibold">Total AO</p>
                <p className="text-base font-extrabold">{formatNumber(depoDetailData.ao)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold mb-2">Top 5 Kota di Depo Ini</p>
              <div className="space-y-1">
                {depoDetailData.topKota.map((k) => (
                  <div key={k.label} className="flex items-center justify-between text-sm py-1 border-b border-ink-50 dark:border-ink-800/60">
                    <span className="font-medium">{k.label}</span>
                    <span className="font-semibold">{formatRupiah(k.value)}</span>
                  </div>
                ))}
                {depoDetailData.topKota.length === 0 && <p className="text-xs text-ink-400">Tidak ada data</p>}
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={!!suppDetail}
        onClose={() => setSuppDetail(null)}
        title={`Ranking DSR: ${suppDetail ?? ''}`}
        subtitle={`Omset tertinggi ke terendah untuk supplier ini · ${depoLabel(filters.depo)} · ${bulanLabel(filters.bulan)} · ${tahunLabel(filters.tahun)}`}
      >
        {suppDetailData && (
          <div className="space-y-1">
            {suppDetailData.map((r, i) => (
              <div key={r.dsr} className="flex items-center justify-between text-sm py-1.5 border-b border-ink-50 dark:border-ink-800/60">
                <span className="font-medium">{i + 1}. {r.dsr}</span>
                <span className="flex items-center gap-3">
                  <span className="text-ink-400 text-xs">{formatNumber(r.ao)} AO</span>
                  <span className="font-semibold">{formatRupiah(r.omset)}</span>
                </span>
              </div>
            ))}
            {suppDetailData.length === 0 && <p className="text-xs text-ink-400">Tidak ada data untuk supplier ini</p>}
          </div>
        )}
      </DetailModal>
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
