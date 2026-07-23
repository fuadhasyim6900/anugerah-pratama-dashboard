import { useMemo, useState, useEffect, useRef } from 'react';
import TopBar from '../components/TopBar';
import KpiCard from '../components/KpiCard';
import BarChartCard from '../components/charts/BarChartCard';
import MultiSelect from '../components/MultiSelect';
import ExportMenu from '../components/ExportMenu';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import {
  applyFilters, salesByDSR, avgMonthlyAOByDSR, telemarketingContribution,
  supplierBreakdownForDSR, formatRupiah, formatNumber, sumNominal,
  distinctDSR, distinctCount, pctChange, depoLabel, bulanLabel, tahunLabel,
  targetVsOmsetBySupplier, targetForDSR, sumTarget, DEPO_LIST_EXCLUDING_ADMIN,
} from '../lib/aggregate';
import { MONTH_NAMES_ID, MONTH_NAMES_FULL_ID } from '../lib/types';
import { LoadingState, ErrorState } from './ExecutiveDashboard';
import { Phone, Search, Crown, Target, Percent } from 'lucide-react';

export default function KinerjaDSR() {
  const { sales, targets, loading, error } = useSalesData();
  const filters = useFilterStore();
  const filtered = useMemo(() => applyFilters(sales, filters), [sales, filters]);

  const ranking = useMemo(() => salesByDSR(filtered), [filtered]);
  const avgAO = useMemo(() => avgMonthlyAOByDSR(filtered), [filtered]);
  const totalOmsetAll = useMemo(() => sumNominal(filtered), [filtered]);

  // Total target across all DSR/supplier combined, within the current
  // Depo/Bulan/Tahun scope — used for the "Target Omset DSR" &
  // "Persentase Pencapaian DSR" KPI cards.
  const totalTargetAllDSR = useMemo(
    () => sumTarget(targets, filters.depo, filters.bulan.length ? filters.bulan : Array.from({ length: 12 }, (_, i) => i + 1), filters.tahun),
    [targets, filters.depo, filters.bulan, filters.tahun]
  );
  const pencapaianAllDSR = totalTargetAllDSR ? (totalOmsetAll / totalTargetAllDSR) * 100 : null;

  const dsrTeraktif = ranking[0] ?? null;
  const dsrTeraktifShare = dsrTeraktif && totalOmsetAll ? (dsrTeraktif.nominal / totalOmsetAll) * 100 : 0;
  const totalAODSR = useMemo(() => avgAO.reduce((a, r) => a + r.avgAo, 0), [avgAO]);

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
  const dsrTarget = useMemo(
    () => (selectedDSR ? targetForDSR(targets, { dsr: selectedDSR, depo: filters.depo, bulan: filters.bulan, tahun: filters.tahun }) : 0),
    [targets, selectedDSR, filters.depo, filters.bulan, filters.tahun]
  );
  const dsrPencapaianPct = dsrTarget ? (dsrTotal / dsrTarget) * 100 : null;

  // The depo the selected DSR actually belongs to (from their own sales
  // rows), used to compare their sales against their whole depo's target —
  // regardless of what the sidebar Depo filter is currently set to.
  const dsrDepo = useMemo(() => dsrRows[0]?.depo ?? '', [dsrRows]);
  const monthsForTarget = useMemo(
    () => (filters.bulan.length ? filters.bulan : Array.from({ length: 12 }, (_, i) => i + 1)),
    [filters.bulan]
  );
  const depoTargetForDSR = useMemo(
    () => (dsrDepo ? sumTarget(targets, [dsrDepo], monthsForTarget, filters.tahun) : 0),
    [targets, dsrDepo, monthsForTarget, filters.tahun]
  );
  const depoPencapaianPct = depoTargetForDSR ? (dsrTotal / depoTargetForDSR) * 100 : null;
  const teleContribution = useMemo(() => telemarketingContribution(dsrRows), [dsrRows]);
  const supplierBreakdown = useMemo(
    () => (selectedDSR ? supplierBreakdownForDSR(filtered, selectedDSR) : []),
    [filtered, selectedDSR]
  );

  const isAllMonths = filters.bulan.length === 0;
  const periodLabel = isAllMonths
    ? `Januari - ${MONTH_NAMES_ID[Math.max(...filtered.map((r) => r.monthNum), 1) - 1] || 'Des'} ${tahunLabel(filters.tahun)}`
    : `${bulanLabel(filters.bulan)} ${tahunLabel(filters.tahun)}`;

  // "Rata-rata" only makes sense when the AO count is actually being averaged
  // across more than one month (i.e. "Semua Bulan" is selected). When a single
  // month is picked, avgMonthlyAOByDSR effectively returns a plain distinct
  // count for that month, so the label should say so instead of "Rata-rata".
  const aoChartTitle = isAllMonths ? 'Rata-rata Outlet Aktif (AO) DSR' : 'Outlet Aktif (AO) DSR';
  const aoChartDesc = isAllMonths
    ? `Rata-rata Bulanan Outlet Unik Terlayani per DSR (Periode ${periodLabel})`
    : `Jumlah Outlet Unik Terlayani per DSR (Periode ${periodLabel})`;
  const aoSeriesName = isAllMonths ? 'Rata-rata AO' : 'AO';
  const aoDetailLabel = isAllMonths ? 'Rata-rata AO Bulanan' : 'Outlet Aktif (AO) Bulan Ini';

  // --- Tabel Perbandingan Sales DSR -----------------------------------
  // Own Tahun A / Tahun B / Nama DSR filters (all multi-select). The main
  // Bulan & Depo filters from the sidebar still apply on top of these.
  const availableYears = useMemo(() => Array.from(new Set(sales.map((r) => r.tahun))).sort(), [sales]);
  const depoOptions = useMemo(() => DEPO_LIST_EXCLUDING_ADMIN(sales), [sales]);
  const [cmpTahunA, setCmpTahunA] = useState<number[]>([]);
  const [cmpTahunB, setCmpTahunB] = useState<number[]>([]);
  useEffect(() => {
    if (availableYears.length >= 2 && cmpTahunA.length === 0 && cmpTahunB.length === 0) {
      setCmpTahunA([availableYears[availableYears.length - 2]]);
      setCmpTahunB([availableYears[availableYears.length - 1]]);
    } else if (availableYears.length === 1 && cmpTahunA.length === 0 && cmpTahunB.length === 0) {
      setCmpTahunA([availableYears[0]]);
      setCmpTahunB([availableYears[0]]);
    }
  }, [availableYears, cmpTahunA.length, cmpTahunB.length]);

  // DSR options for the "Nama DSR" filters below match the same active DSR
  // list as "Daftar DSR" on this page (i.e. respect Depo/Bulan/Tahun), so a
  // DSR with no data in the selected period (e.g. ARDIAN in 2026) simply
  // won't show up as a selectable option.
  const dsrOptionsForCompare = useMemo(() => distinctDSR(filtered), [filtered]);
  const [compareDSR, setCompareDSR] = useState<string[]>([]);
  // Drop any selected DSR names that are no longer valid options (e.g. depo filter changed).
  useEffect(() => {
    setCompareDSR((prev) => prev.filter((d) => dsrOptionsForCompare.includes(d)));
  }, [dsrOptionsForCompare]);

  // Independent month filters for each side of the comparison (Tahun A / Tahun
  // B), so e.g. "Jan-Jun Tahun A" can be compared against "Jan-Des Tahun B".
  // Empty selection = all 12 months for that side.
  const [cmpBulanA, setCmpBulanA] = useState<number[]>([]);
  const [cmpBulanB, setCmpBulanB] = useState<number[]>([]);
  const ALL_MONTHS = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const cmpBulanAEffective = cmpBulanA.length ? cmpBulanA : ALL_MONTHS;
  const cmpBulanBEffective = cmpBulanB.length ? cmpBulanB : ALL_MONTHS;
  const cmpMonthsToShow = useMemo(
    () => Array.from(new Set([...cmpBulanAEffective, ...cmpBulanBEffective])).sort((a, b) => a - b),
    [cmpBulanAEffective, cmpBulanBEffective]
  );

  const dsrSalesComparison = useMemo(() => {
    let rowsA = applyFilters(sales, { depo: filters.depo, bulan: [], tahun: cmpTahunA });
    let rowsB = applyFilters(sales, { depo: filters.depo, bulan: [], tahun: cmpTahunB });
    if (compareDSR.length) {
      rowsA = rowsA.filter((r) => compareDSR.includes(r.sales));
      rowsB = rowsB.filter((r) => compareDSR.includes(r.sales));
    }

    const rows = cmpMonthsToShow.map((monthNum) => {
      const label = MONTH_NAMES_ID[monthNum - 1];
      const inA = cmpBulanAEffective.includes(monthNum);
      const inB = cmpBulanBEffective.includes(monthNum);
      const aRows = inA ? rowsA.filter((r) => r.monthNum === monthNum) : [];
      const bRows = inB ? rowsB.filter((r) => r.monthNum === monthNum) : [];
      const salesA = sumNominal(aRows);
      const salesB = sumNominal(bRows);
      const aoA = distinctCount(aRows, 'kdGrup');
      const aoB = distinctCount(bRows, 'kdGrup');
      return {
        bulan: label,
        salesA, salesB,
        salesGrowth: inA && inB ? pctChange(salesB, salesA) : null,
        aoA, aoB,
        aoGrowth: inA && inB ? pctChange(aoB, aoA) : null,
        inA, inB,
      };
    });

    const rowsAInScope = rowsA.filter((r) => cmpBulanAEffective.includes(r.monthNum));
    const rowsBInScope = rowsB.filter((r) => cmpBulanBEffective.includes(r.monthNum));
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
  }, [sales, filters.depo, cmpMonthsToShow, cmpBulanAEffective, cmpBulanBEffective, cmpTahunA, cmpTahunB, compareDSR]);

  const cmpTahunALabel = cmpTahunA.length ? [...cmpTahunA].sort((a, b) => a - b).join('+') : '-';
  const cmpTahunBLabel = cmpTahunB.length ? [...cmpTahunB].sort((a, b) => a - b).join('+') : '-';

  // --- Tabel Target vs Omset per Supplier ------------------------------
  // Own "Nama DSR" and "Supplier" filters (multi-select, default = semua).
  // The main Depo/Bulan/Tahun filters from the sidebar still apply on top.
  const [targetDSRFilter, setTargetDSRFilter] = useState<string[]>([]);
  useEffect(() => {
    setTargetDSRFilter((prev) => prev.filter((d) => dsrOptionsForCompare.includes(d)));
  }, [dsrOptionsForCompare]);

  const suppOptionsForTarget = useMemo(
    () => Array.from(new Set(filtered.map((r) => r.supp).filter(Boolean))).sort(),
    [filtered]
  );
  const [targetSuppFilter, setTargetSuppFilter] = useState<string[]>([]);
  useEffect(() => {
    setTargetSuppFilter((prev) => prev.filter((s) => suppOptionsForTarget.includes(s)));
  }, [suppOptionsForTarget]);

  const targetVsOmset = useMemo(
    () => targetVsOmsetBySupplier(sales, targets, {
      depo: filters.depo, bulan: filters.bulan, tahun: filters.tahun, dsr: targetDSRFilter, supp: targetSuppFilter,
    }),
    [sales, targets, filters.depo, filters.bulan, filters.tahun, targetDSRFilter, targetSuppFilter]
  );

  const rankingChartRef = useRef<HTMLDivElement>(null);
  const aoChartRef = useRef<HTMLDivElement>(null);
  const supplierBreakdownRef = useRef<HTMLDivElement>(null);
  const dsrComparisonRef = useRef<HTMLDivElement>(null);
  const targetVsOmsetRef = useRef<HTMLDivElement>(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <TopBar title="Kinerja DSR" subtitle={`${depoLabel(filters.depo)} · Periode ${periodLabel}`} />
      <div id="page-content" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <KpiCard
            label="DSR Teraktif"
            value={dsrTeraktif ? dsrTeraktif.dsr : '-'}
            icon={Crown}
            sub={dsrTeraktif ? `${formatRupiah(dsrTeraktif.nominal)} · ${dsrTeraktifShare.toFixed(1)}% dari total omset` : undefined}
          />
          <KpiCard label="Jumlah DSR Aktif" value={`${formatNumber(ranking.length)} DSR`} />
          <KpiCard label="Total Omset Semua DSR" value={formatRupiah(totalOmsetAll)} />
          <KpiCard label="Target Omset DSR" value={formatRupiah(totalTargetAllDSR)} icon={Target} />
          <KpiCard
            label="Persentase Pencapaian DSR"
            value={pencapaianAllDSR === null ? '-' : `${pencapaianAllDSR.toFixed(1)}%`}
            icon={Percent}
            accent={pencapaianAllDSR !== null && pencapaianAllDSR >= 100 ? 'brand' : 'ink'}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-5" ref={rankingChartRef}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="font-bold text-sm">Peringkat Penjualan DSR</h3>
              <ExportMenu targetRef={rankingChartRef} filename="peringkat-penjualan-dsr" />
            </div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs text-ink-400">Total Penjualan DSR Periode {periodLabel} (Aktual)</p>
              <p className="text-xs font-bold text-brand-600 whitespace-nowrap">
                Total: {formatRupiah(totalOmsetAll)}
              </p>
            </div>
            <BarChartCard
              data={ranking.map((r) => ({ dsr: r.dsr, Omset: r.nominal }))}
              xKey="dsr"
              horizontal
              height={Math.max(260, ranking.length * 28)}
              series={[{ key: 'Omset', color: '#dc2626', name: 'Omset' }]}
            />
          </div>

          <div className="card p-5" ref={aoChartRef}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="font-bold text-sm">{aoChartTitle}</h3>
              <ExportMenu targetRef={aoChartRef} filename="ao-dsr" />
            </div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs text-ink-400">{aoChartDesc}</p>
              <p className="text-xs font-bold text-brand-600 whitespace-nowrap">
                Total AO: {formatNumber(totalAODSR)} Outlet
              </p>
            </div>
            <BarChartCard
              data={avgAO.map((r) => ({ dsr: r.dsr, AO: r.avgAo }))}
              xKey="dsr"
              horizontal
              height={Math.max(260, avgAO.length * 28)}
              valueFormatter={(v) => `${formatNumber(v)} outlet`}
              series={[{ key: 'AO', color: '#b91c1c', name: aoSeriesName }]}
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

          <div className="card p-5" ref={supplierBreakdownRef}>
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div>
                <h3 className="font-bold text-sm">Distribusi Produk / Supplier DSR</h3>
                <p className="text-xs text-ink-400">Breakdown Penjualan DSR Terpilih di {tahunLabel(filters.tahun)} YTD</p>
                <p className="text-lg font-extrabold mt-1">DSR: {selectedDSR ?? '-'}</p>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex flex-wrap gap-6">
                  <div className="text-right">
                    <p className="text-xs text-ink-400 font-semibold">Total Sales ({periodLabel})</p>
                    <p className="text-xl font-extrabold text-brand-600">{formatRupiah(dsrTotal)}</p>
                    <p className="text-[11px] text-ink-400 mt-1">Target {selectedDSR ?? '-'}: {formatRupiah(dsrTarget)}</p>
                    <p className={`text-xs font-bold ${
                      dsrPencapaianPct === null ? 'text-ink-400'
                        : dsrPencapaianPct >= 100 ? 'text-emerald-600'
                        : 'text-brand-600'
                    }`}>
                      {dsrPencapaianPct === null ? '-' : `${dsrPencapaianPct.toFixed(1)}% dari target ${selectedDSR ?? '-'}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-400 font-semibold">Sales {selectedDSR ?? '-'} ({periodLabel})</p>
                    <p className="text-xl font-extrabold text-brand-600">{formatRupiah(dsrTotal)}</p>
                    <p className="text-[11px] text-ink-400 mt-1">Target Depo {dsrDepo || '-'}: {formatRupiah(depoTargetForDSR)}</p>
                    <p className={`text-xs font-bold ${
                      depoPencapaianPct === null ? 'text-ink-400'
                        : depoPencapaianPct >= 100 ? 'text-emerald-600'
                        : 'text-brand-600'
                    }`}>
                      {depoPencapaianPct === null ? '-' : `${depoPencapaianPct.toFixed(1)}% dari target Depo ${dsrDepo || '-'}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-400 font-semibold">{aoDetailLabel}</p>
                    <p className="text-xl font-extrabold">{formatNumber(dsrAvgAO)} Outlet</p>
                  </div>
                </div>
                <ExportMenu targetRef={supplierBreakdownRef} filename="distribusi-produk-supplier-dsr" />
              </div>
            </div>

            {selectedDSR && (
              <p className="text-[11px] text-ink-400 -mt-2 mb-4">
                Target {selectedDSR} = target milik {selectedDSR} sendiri. Target Depo {dsrDepo || '-'} = total target seluruh DSR di Depo {dsrDepo || '-'}, keduanya untuk periode {periodLabel}. Kedua persentase dihitung dari sales {selectedDSR} yang sama (Total Sales) dibagi masing-masing target tersebut.
              </p>
            )}

            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 text-xs font-semibold w-fit">
              <Phone size={14} />
              Kontribusi Omset Telemarketing: {formatRupiah(teleContribution)}
              {dsrTotal > 0 && (
                <span className="text-brand-500 dark:text-brand-300 font-bold">
                  ({((teleContribution / dsrTotal) * 100).toFixed(1)}% dari omset {selectedDSR ?? '-'})
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                    <th className="py-2 pr-3">Nama Brand / Supplier</th>
                    <th className="py-2 pr-3 text-right">Penjualan {tahunLabel(filters.tahun)} (YTD)</th>
                    <th className="py-2 pr-3 text-right">Porsi (%)</th>
                    <th className="py-2 pr-3 text-right">{isAllMonths ? 'Rata-rata AO' : 'AO'}</th>
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

        <div className="card p-5" ref={dsrComparisonRef}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-sm">Tabel Perbandingan Sales DSR</h3>
              <p className="text-xs text-ink-400">
                Perbandingan penjualan &amp; AO antar dua kelompok tahun, per bulan · {depoLabel(filters.depo)} · {bulanLabel(filters.bulan)}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-36">
                <MultiSelect
                  label="Tahun A"
                  options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
                  selected={cmpTahunA.map(String)}
                  onChange={(v) => setCmpTahunA(v.map(Number))}
                  allLabel="Pilih Tahun A"
                />
              </div>
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Bulan Tahun A"
                  options={MONTH_NAMES_FULL_ID.map((m, i) => ({ value: String(i + 1), label: m }))}
                  selected={cmpBulanA.map(String)}
                  onChange={(v) => setCmpBulanA(v.map(Number))}
                  allLabel="Semua Bulan (YTD)"
                />
              </div>
              <div className="w-full sm:w-36">
                <MultiSelect
                  label="Tahun B"
                  options={availableYears.map((y) => ({ value: String(y), label: String(y) }))}
                  selected={cmpTahunB.map(String)}
                  onChange={(v) => setCmpTahunB(v.map(Number))}
                  allLabel="Pilih Tahun B"
                />
              </div>
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Bulan Tahun B"
                  options={MONTH_NAMES_FULL_ID.map((m, i) => ({ value: String(i + 1), label: m }))}
                  selected={cmpBulanB.map(String)}
                  onChange={(v) => setCmpBulanB(v.map(Number))}
                  allLabel="Semua Bulan (YTD)"
                />
              </div>
              <div className="w-full sm:w-48">
                <MultiSelect
                  label="Nama DSR"
                  options={dsrOptionsForCompare.map((d) => ({ value: d, label: d }))}
                  selected={compareDSR}
                  onChange={setCompareDSR}
                  allLabel="Semua DSR"
                />
              </div>
              <ExportMenu targetRef={dsrComparisonRef} filename="perbandingan-sales-dsr" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3">Bulan</th>
                  <th className="py-2 pr-3 text-right">Penjualan Tahun {cmpTahunALabel}</th>
                  <th className="py-2 pr-3 text-right">Penjualan Tahun {cmpTahunBLabel}</th>
                  <th className="py-2 pr-3 text-right">Pertumbuhan Sales (%)</th>
                  <th className="py-2 pr-3 text-right">AO Tahun {cmpTahunALabel}</th>
                  <th className="py-2 pr-3 text-right">AO Tahun {cmpTahunBLabel}</th>
                  <th className="py-2 pr-3 text-right">Pertumbuhan AO (%)</th>
                </tr>
              </thead>
              <tbody>
                {dsrSalesComparison.rows.map((m) => (
                  <tr key={m.bulan} className="border-b border-ink-50 dark:border-ink-800/60">
                    <td className="py-2 pr-3 font-semibold">{m.bulan}</td>
                    <td className="py-2 pr-3 text-right">{m.inA ? formatRupiah(m.salesA) : '-'}</td>
                    <td className="py-2 pr-3 text-right">{m.inB ? formatRupiah(m.salesB) : '-'}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${m.salesGrowth === null ? 'text-ink-400' : m.salesGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {m.salesGrowth === null ? '-' : `${m.salesGrowth >= 0 ? '+' : ''}${m.salesGrowth.toFixed(1)}%`}
                    </td>
                    <td className="py-2 pr-3 text-right">{m.inA ? formatNumber(m.aoA) : '-'}</td>
                    <td className="py-2 pr-3 text-right">{m.inB ? formatNumber(m.aoB) : '-'}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${m.aoGrowth === null ? 'text-ink-400' : m.aoGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {m.aoGrowth === null ? '-' : `${m.aoGrowth >= 0 ? '+' : ''}${m.aoGrowth.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {dsrSalesComparison.rows.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-ink-400">Tidak ada data untuk filter ini</td></tr>
                )}
                {dsrSalesComparison.grandTotal && dsrSalesComparison.rows.length > 0 && (
                  <tr className="border-t-2 border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 font-extrabold">
                    <td className="py-2.5 pr-3">Grand Total</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(dsrSalesComparison.grandTotal.salesA)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(dsrSalesComparison.grandTotal.salesB)}</td>
                    <td className={`py-2.5 pr-3 text-right ${dsrSalesComparison.grandTotal.salesGrowth === null ? 'text-ink-400' : dsrSalesComparison.grandTotal.salesGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {dsrSalesComparison.grandTotal.salesGrowth === null ? '-' : `${dsrSalesComparison.grandTotal.salesGrowth >= 0 ? '+' : ''}${dsrSalesComparison.grandTotal.salesGrowth.toFixed(1)}%`}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(dsrSalesComparison.grandTotal.aoA)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(dsrSalesComparison.grandTotal.aoB)}</td>
                    <td className={`py-2.5 pr-3 text-right ${dsrSalesComparison.grandTotal.aoGrowth === null ? 'text-ink-400' : dsrSalesComparison.grandTotal.aoGrowth >= 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {dsrSalesComparison.grandTotal.aoGrowth === null ? '-' : `${dsrSalesComparison.grandTotal.aoGrowth >= 0 ? '+' : ''}${dsrSalesComparison.grandTotal.aoGrowth.toFixed(1)}%`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5" ref={targetVsOmsetRef}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-sm">Tabel Target vs Omset per Supplier</h3>
              <p className="text-xs text-ink-400">
                Perbandingan target dan realisasi omset DSR per supplier · {depoLabel(filters.depo)} · {bulanLabel(filters.bulan)} · {tahunLabel(filters.tahun)}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Depo"
                  options={depoOptions.map((d) => ({ value: d, label: d }))}
                  selected={filters.depo}
                  onChange={filters.setDepo}
                  allLabel="Semua Depo"
                />
              </div>
              <div className="w-full sm:w-48">
                <MultiSelect
                  label="Supplier"
                  options={suppOptionsForTarget.map((s) => ({ value: s, label: s }))}
                  selected={targetSuppFilter}
                  onChange={setTargetSuppFilter}
                  allLabel="Semua Supplier"
                />
              </div>
              <div className="w-full sm:w-56">
                <MultiSelect
                  label="Nama DSR"
                  options={dsrOptionsForCompare.map((d) => ({ value: d, label: d }))}
                  selected={targetDSRFilter}
                  onChange={setTargetDSRFilter}
                  allLabel="Semua DSR"
                />
              </div>
              <ExportMenu targetRef={targetVsOmsetRef} filename="target-vs-omset-per-supplier" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3 text-right">Target</th>
                  <th className="py-2 pr-3 text-right">Omset</th>
                  <th className="py-2 pr-3 text-right">Pencapaian (%)</th>
                  <th className="py-2 pr-3 text-right">Jumlah AO</th>
                  <th className="py-2 pr-3 text-right">Kekurangan</th>
                </tr>
              </thead>
              <tbody>
                {targetVsOmset.rows.map((r) => {
                  const pencapaianPct = r.target ? (r.omset / r.target) * 100 : null;
                  return (
                    <tr key={r.supplier} className="border-b border-ink-50 dark:border-ink-800/60">
                      <td className="py-2 pr-3 font-semibold">{r.supplier}</td>
                      <td className="py-2 pr-3 text-right">{formatRupiah(r.target)}</td>
                      <td className="py-2 pr-3 text-right">{formatRupiah(r.omset)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-ink-900 dark:text-ink-100">
                        {pencapaianPct === null ? '-' : `${pencapaianPct.toFixed(1)}%`}
                      </td>
                      <td className="py-2 pr-3 text-right">{formatNumber(r.ao)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold ${r.kekurangan > 0 ? 'text-brand-600' : 'text-emerald-600'}`}>
                        {formatRupiah(r.kekurangan)}
                      </td>
                    </tr>
                  );
                })}
                {targetVsOmset.rows.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-ink-400">Tidak ada data untuk filter ini</td></tr>
                )}
                {targetVsOmset.rows.length > 0 && (() => {
                  const grandPencapaianPct = targetVsOmset.grandTotal.target
                    ? (targetVsOmset.grandTotal.omset / targetVsOmset.grandTotal.target) * 100
                    : null;
                  return (
                    <tr className="border-t-2 border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 font-extrabold">
                      <td className="py-2.5 pr-3">Grand Total</td>
                      <td className="py-2.5 pr-3 text-right">{formatRupiah(targetVsOmset.grandTotal.target)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatRupiah(targetVsOmset.grandTotal.omset)}</td>
                      <td className="py-2.5 pr-3 text-right text-ink-900 dark:text-ink-100">
                        {grandPencapaianPct === null ? '-' : `${grandPencapaianPct.toFixed(1)}%`}
                      </td>
                      <td className="py-2.5 pr-3 text-right">{formatNumber(targetVsOmset.grandTotal.ao)}</td>
                      <td className={`py-2.5 pr-3 text-right ${targetVsOmset.grandTotal.kekurangan > 0 ? 'text-brand-600' : 'text-emerald-600'}`}>
                        {formatRupiah(targetVsOmset.grandTotal.kekurangan)}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-ink-400 mt-3">
            Kekurangan = Target − Omset. Pencapaian (%) = Omset ÷ Target × 100%. Nilai merah berarti omset belum mencapai target (pencapaian di bawah 100%); nilai hijau berarti omset sudah mencapai atau melampaui target (pencapaian 100% atau lebih). Jumlah AO dihitung per kombinasi Supplier &amp; KD Grup.
          </p>
        </div>
      </div>
    </div>
  );
}
