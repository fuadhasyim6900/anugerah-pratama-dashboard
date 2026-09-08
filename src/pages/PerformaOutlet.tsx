import { useEffect, useMemo, useRef, useState } from 'react';
import { Store, Wallet } from 'lucide-react';
import TopBar from '../components/TopBar';
import KpiCard from '../components/KpiCard';
import LineChartCard from '../components/charts/LineChartCard';
import BarChartCard from '../components/charts/BarChartCard';
import MultiSelect from '../components/MultiSelect';
import ExportMenu from '../components/ExportMenu';
import DetailModal from '../components/DetailModal';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import {
  applyFilters, sumNominal, distinctCount, formatRupiah, formatNumber,
  depoLabel, tahunLabel, DEPO_LIST_EXCLUDING_ADMIN, SUPP_LIST, activeDsrList,
} from '../lib/aggregate';
import { MONTH_NAMES_FULL_ID } from '../lib/types';
import {
  QUARTAL_OPTIONS, filterByQuartal, filterByKodeToko, filterByBulanPopup,
  distinctKodeTokoOptions, distinctNamaPelangganOptions,
  outletPerformanceTrend, YEAR_LINE_COLORS, supplierPerformanceBars, itemsForSupplier,
} from '../lib/performaOutlet';
import { LoadingState, ErrorState } from './ExecutiveDashboard';

export default function PerformaOutlet() {
  const { sales, loading, error } = useSalesData();
  const filters = useFilterStore();

  // Urutan filter halaman ini: Depo -> Supplier -> Nama Sales -> Kode Toko ->
  // Nama Pelanggan -> Tahun -> Quartal. Depo/Supplier/Nama Sales/Tahun
  // memakai filter global di sidebar (sama seperti halaman lain, jadi tetap
  // sinkron dengan tombol Filter di atas); Kode Toko/Nama Pelanggan/Quartal
  // adalah filter lokal khusus halaman ini (bulan global sengaja diabaikan
  // karena sumbu X grafik ini selalu Jan-Des penuh).
  const scopedByGlobal = useMemo(
    () => applyFilters(sales, { ...filters, bulan: [] }),
    [sales, filters]
  );

  // Kode Toko & Nama Pelanggan sama-sama mengisi satu state ini (satu toko =
  // satu kodePelanggan) — cuma tampilan/urutan pencariannya beda, jadi
  // orang bisa cari lewat kode ATAU lewat nama, mana yang lebih diingat.
  const [kodeToko, setKodeToko] = useState<string[]>([]);
  const kodeTokoOptions = useMemo(() => distinctKodeTokoOptions(scopedByGlobal), [scopedByGlobal]);
  const namaPelangganOptions = useMemo(() => distinctNamaPelangganOptions(scopedByGlobal), [scopedByGlobal]);
  useEffect(() => {
    setKodeToko((prev) => prev.filter((k) => kodeTokoOptions.some((o) => o.value === k)));
  }, [kodeTokoOptions]);

  const [quartal, setQuartal] = useState<number[]>([]);

  const scopedByKodeToko = useMemo(() => filterByKodeToko(scopedByGlobal, kodeToko), [scopedByGlobal, kodeToko]);
  const filtered = useMemo(() => filterByQuartal(scopedByKodeToko, quartal), [scopedByKodeToko, quartal]);

  // Daftar pilihan Depo/Supplier/Tahun dari seluruh data (sama seperti
  // FilterPopover di TopBar); Nama Sales dipersempit ke Depo/Tahun yang
  // sedang aktif (sama seperti "Sales" di halaman Omset Harian) — jadi kalau
  // Depo=Jepara dipilih, dropdown Nama Sales cuma menampilkan sales yang
  // memang aktif di Jepara.
  const depoOptions = useMemo(() => DEPO_LIST_EXCLUDING_ADMIN(sales), [sales]);
  const suppOptions = useMemo(() => SUPP_LIST(sales), [sales]);
  const tahunOptions = useMemo(() => Array.from(new Set(sales.map((r) => r.tahun))).sort(), [sales]);
  const dsrOptions = useMemo(
    () => activeDsrList(sales, filters.depo, [], filters.tahun),
    [sales, filters.depo, filters.tahun]
  );

  const totalOmset = useMemo(() => sumNominal(filtered), [filtered]);
  const totalAO = useMemo(() => distinctCount(filtered, 'kdGrup'), [filtered]);

  const trend = useMemo(() => outletPerformanceTrend(filtered), [filtered]);
  const barData = useMemo(() => supplierPerformanceBars(filtered), [filtered]);

  const trendRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // --- Popup "Daftar Barang" saat bar Supplier diklik ---------------------
  // Filter Bulan di sini khusus mempersempit daftar barang di dalam popup
  // (tidak memengaruhi grafik Performa Outlet/Performa Supplier di
  // belakangnya), plus tombol Unduh untuk menyimpan daftarnya.
  const [supplierDetail, setSupplierDetail] = useState<string | null>(null);
  const [popupBulan, setPopupBulan] = useState<number[]>([]);
  useEffect(() => {
    if (!supplierDetail) setPopupBulan([]);
  }, [supplierDetail]);

  const popupRows = useMemo(() => filterByBulanPopup(filtered, popupBulan), [filtered, popupBulan]);
  const itemDetailData = useMemo(
    () => (supplierDetail ? itemsForSupplier(popupRows, supplierDetail) : []),
    [supplierDetail, popupRows]
  );
  const itemListRef = useRef<HTMLDivElement>(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <TopBar
        title="Performa Outlet"
        subtitle={`${depoLabel(filters.depo)} · ${filters.supp.length ? filters.supp.join(', ') : 'Semua Supplier'} · ${filters.dsr.length ? filters.dsr.join(', ') : 'Semua Sales'} · ${tahunLabel(filters.tahun)}${quartal.length ? ` · Q${quartal.join(', Q')}` : ''}`}
      />
      <div id="page-content" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          <KpiCard label="Total Omset" value={formatRupiah(totalOmset)} icon={Wallet} />
          <KpiCard label="Total Active Outlet" value={`${formatNumber(totalAO)} Outlet`} icon={Store} />
        </div>

        <div id="sec-performa-outlet-trend" className="card p-5 scroll-mt-28" ref={trendRef}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
            <div>
              <h3 className="font-bold text-sm">Performa Outlet</h3>
              <p className="text-xs text-ink-400">
                Omset per bulan (Jan - Des), satu garis per Tahun, diturunkan dari Tgl Faktur
                {filters.depo.length ? ` · ${depoLabel(filters.depo)}` : ''}
                {filters.supp.length ? ` · ${filters.supp.join(', ')}` : ''}
                {filters.dsr.length ? ` · Sales: ${filters.dsr.join(', ')}` : ''}
                {kodeToko.length ? ` · ${kodeToko.length} Toko Dipilih` : ''}
              </p>
              <p className="text-xs font-bold text-brand-600 whitespace-nowrap mt-1">
                Total Omset: {formatRupiah(totalOmset)}
              </p>
            </div>
            {/* Urutan filter: Depo, Supplier, Nama Sales, Kode Toko, Nama Pelanggan, Tahun, Quartal */}
            <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-40">
                <MultiSelect
                  label="Depo"
                  options={depoOptions.map((d) => ({ value: d, label: d }))}
                  selected={filters.depo}
                  onChange={filters.setDepo}
                  allLabel="Semua Depo"
                />
              </div>
              <div className="w-full sm:w-40">
                <MultiSelect
                  label="Supplier"
                  options={suppOptions.map((s) => ({ value: s, label: s }))}
                  selected={filters.supp}
                  onChange={filters.setSupp}
                  allLabel="Semua Supplier"
                />
              </div>
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Nama Sales"
                  options={dsrOptions.map((d) => ({ value: d, label: d }))}
                  selected={filters.dsr}
                  onChange={filters.setDsr}
                  allLabel="Semua Sales"
                  searchable
                  searchPlaceholder="Cari nama sales..."
                />
              </div>
              <div className="w-full sm:w-52">
                <MultiSelect
                  label="Kode Toko"
                  options={kodeTokoOptions}
                  selected={kodeToko}
                  onChange={setKodeToko}
                  allLabel="Semua Kode Toko"
                  searchable
                  searchPlaceholder="Cari kode toko..."
                />
              </div>
              <div className="w-full sm:w-56">
                <MultiSelect
                  label="Nama Pelanggan"
                  options={namaPelangganOptions}
                  selected={kodeToko}
                  onChange={setKodeToko}
                  allLabel="Semua Pelanggan"
                  searchable
                  searchPlaceholder="Cari nama pelanggan..."
                />
              </div>
              <div className="w-full sm:w-28">
                <MultiSelect
                  label="Tahun"
                  options={tahunOptions.map((y) => ({ value: String(y), label: String(y) }))}
                  selected={filters.tahun.map(String)}
                  onChange={(v) => filters.setTahun(v.map(Number))}
                  allLabel="Semua Tahun"
                />
              </div>
              <div className="w-full sm:w-40">
                <MultiSelect
                  label="Quartal"
                  options={QUARTAL_OPTIONS}
                  selected={quartal.map(String)}
                  onChange={(v) => setQuartal(v.map(Number))}
                  allLabel="Semua Quartal"
                />
              </div>
              <ExportMenu targetRef={trendRef} filename="performa-outlet" />
            </div>
          </div>
          <div className="mt-3">
            <LineChartCard
              data={trend.data}
              xKey="bulan"
              series={trend.years.map((y, i) => ({
                key: String(y),
                color: YEAR_LINE_COLORS[i % YEAR_LINE_COLORS.length],
                name: String(y),
              }))}
              height={340}
            />
          </div>
          {trend.years.length === 0 && (
            <p className="text-xs text-ink-400 mt-2 text-center">Tidak ada data untuk kombinasi filter ini.</p>
          )}
          <p className="text-[11px] text-ink-400 mt-2">
            Filter Depo/Supplier/Nama Sales/Kode Toko/Nama Pelanggan/Tahun/Quartal di atas berlaku untuk grafik ini dan grafik Performa Supplier di bawah. Kode Toko &amp; Nama Pelanggan menyaring toko yang sama — pilih dari salah satu, mana yang lebih mudah diingat.
          </p>
        </div>

        <div id="sec-performa-outlet-supplier" className="card p-5 scroll-mt-28" ref={barRef}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
            <div>
              <h3 className="font-bold text-sm">Performa Supplier</h3>
              <p className="text-xs text-ink-400">
                Akumulasi Omset per Supplier, mengikuti filter Performa Outlet di atas. Klik salah satu bar untuk melihat daftar barang yang dibeli.
              </p>
            </div>
            <ExportMenu targetRef={barRef} filename="performa-supplier" />
          </div>
          <div className="mt-3">
            <BarChartCard
              data={barData.map((d) => ({ label: d.supplier, Omset: d.nominal }))}
              xKey="label"
              series={[{ key: 'Omset', color: '#16a34a', name: 'Omset' }]}
              horizontal
              height={Math.max(240, barData.length * 34)}
              onItemClick={setSupplierDetail}
            />
          </div>
          {barData.length === 0 && (
            <p className="text-xs text-ink-400 mt-2 text-center">Tidak ada data untuk kombinasi filter ini.</p>
          )}
        </div>
      </div>

      <DetailModal
        open={!!supplierDetail}
        onClose={() => setSupplierDetail(null)}
        title={`Daftar Barang: ${supplierDetail ?? ''}`}
        subtitle={`${depoLabel(filters.depo)} · ${tahunLabel(filters.tahun)}${quartal.length ? ` · Q${quartal.join(', Q')}` : ''}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <div className="w-full sm:w-56">
            <MultiSelect
              label="Bulan"
              options={MONTH_NAMES_FULL_ID.map((m, i) => ({ value: String(i + 1), label: m }))}
              selected={popupBulan.map(String)}
              onChange={(v) => setPopupBulan(v.map(Number))}
              allLabel="Semua Bulan"
            />
          </div>
          <ExportMenu targetRef={itemListRef} filename={`daftar-barang-${supplierDetail ?? 'supplier'}`} />
        </div>
        <div ref={itemListRef} className="space-y-1">
          {itemDetailData.map((it) => (
            <div key={it.namaBarang} className="flex items-center justify-between text-sm py-1.5 border-b border-ink-50 dark:border-ink-800/60">
              <span className="font-medium truncate pr-2">{it.namaBarang}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-ink-400 text-xs">{formatNumber(it.qty)} qty</span>
                <span className="font-semibold">{formatRupiah(it.nominal)}</span>
              </span>
            </div>
          ))}
          {itemDetailData.length === 0 && <p className="text-xs text-ink-400">Tidak ada data barang untuk supplier/bulan ini</p>}
        </div>
      </DetailModal>
    </div>
  );
}
