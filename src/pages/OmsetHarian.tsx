import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Wallet, Store, PackageSearch, LineChart, ListOrdered, History } from 'lucide-react';
import TopBar from '../components/TopBar';
import KpiCard from '../components/KpiCard';
import BarChartCard from '../components/charts/BarChartCard';
import MultiSelect from '../components/MultiSelect';
import ExportMenu from '../components/ExportMenu';
import Tabs, { TabPanel } from '../components/Tabs';
import DetailModal from '../components/DetailModal';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import {
  applyFilters, sumNominal, distinctCount, formatRupiah, formatNumber,
  depoLabel, bulanLabel, tahunLabel, DEPO_LIST_EXCLUDING_ADMIN, SUPP_LIST,
} from '../lib/aggregate';
import { MONTH_NAMES_FULL_ID } from '../lib/types';
import {
  filterByTanggal, distinctTanggalPresent, dailyTrend, itemsBySupplierQty,
  customerPurchaseHistory, formatTanggalPendek,
} from '../lib/omsetHarian';
import { LoadingState, ErrorState } from './ExecutiveDashboard';

const TOP_ITEMS_LIMIT = 15;
const HISTORY_ROWS_LIMIT = 200;

const HARIAN_TABS = [
  { id: 'grafik', label: 'Grafik Harian', icon: <LineChart size={14} />, sectionIds: ['sec-omset-harian'] },
  { id: 'barang', label: 'Barang Terlaris', icon: <ListOrdered size={14} />, sectionIds: ['sec-barang-terlaris'] },
  { id: 'riwayat', label: 'Riwayat Pengambilan', icon: <History size={14} />, sectionIds: ['sec-riwayat-pengambilan'] },
];

export default function OmsetHarian() {
  const { sales, loading, error } = useSalesData();
  const filters = useFilterStore();

  // Filter Depo/Sales DSR/SUPP/Bulan/Tahun memakai filter global di sidebar
  // (sama seperti halaman lain), ditambah filter "Tanggal" (hari dalam
  // bulan) khusus di halaman ini untuk drill-down harian.
  const scoped = useMemo(() => applyFilters(sales, filters), [sales, filters]);

  const [tanggal, setTanggal] = useState<number[]>([]);
  const tanggalOptions = useMemo(() => distinctTanggalPresent(scoped), [scoped]);
  useEffect(() => {
    setTanggal((prev) => prev.filter((t) => tanggalOptions.includes(t)));
  }, [tanggalOptions]);

  const filtered = useMemo(() => filterByTanggal(scoped, tanggal), [scoped, tanggal]);

  const totalOmset = useMemo(() => sumNominal(filtered), [filtered]);
  const totalAO = useMemo(() => distinctCount(filtered, 'kdGrup'), [filtered]);
  const totalQty = useMemo(() => filtered.reduce((a, r) => a + r.qty, 0), [filtered]);
  const jumlahHari = useMemo(() => distinctTanggalPresent(filtered).length, [filtered]);

  const trend = useMemo(() => dailyTrend(filtered), [filtered]);

  const itemRows = useMemo(() => itemsBySupplierQty(filtered), [filtered]);
  const topItems = useMemo(() => itemRows.slice(0, TOP_ITEMS_LIMIT), [itemRows]);
  const itemTotalQty = useMemo(() => itemRows.reduce((a, r) => a + r.qty, 0), [itemRows]);
  const itemTotalNominal = useMemo(() => itemRows.reduce((a, r) => a + r.nominal, 0), [itemRows]);

  // --- Riwayat pengambilan barang: filter lokal tambahan (No Faktur & KD
  // Pelanggan menyaring baris faktur SEBELUM diringkas per Pelanggan+Barang,
  // sedangkan Nama Pelanggan cari teks bebas setelah diringkas; Depo/SUPP/
  // Bulan/Tahun langsung memakai filter global di sidebar (setDepo/setSupp/
  // setBulan/setTahun) dan disediakan juga sebagai kontrol lokal di section
  // ini biar tidak perlu pindah ke tombol Filter di atas, sementara Tanggal
  // memakai state `tanggal` yang sama dengan tab Grafik Harian).
  const depoOptions = useMemo(() => DEPO_LIST_EXCLUDING_ADMIN(sales), [sales]);
  const suppOptions = useMemo(() => SUPP_LIST(sales), [sales]);
  const tahunOptions = useMemo(() => Array.from(new Set(sales.map((r) => r.tahun))).sort(), [sales]);
  const [historySearchNoFaktur, setHistorySearchNoFaktur] = useState('');
  const [historySearchKdPelanggan, setHistorySearchKdPelanggan] = useState('');
  const [historySearchNamaPelanggan, setHistorySearchNamaPelanggan] = useState('');
  const historyScopedRows = useMemo(() => {
    const qFaktur = historySearchNoFaktur.trim().toLowerCase();
    const qKd = historySearchKdPelanggan.trim().toLowerCase();
    if (!qFaktur && !qKd) return filtered;
    return filtered.filter((r) =>
      (!qFaktur || r.noFaktur.toLowerCase().includes(qFaktur)) &&
      (!qKd || r.kodePelanggan.toLowerCase().includes(qKd))
    );
  }, [filtered, historySearchNoFaktur, historySearchKdPelanggan]);
  const historyAll = useMemo(() => customerPurchaseHistory(historyScopedRows), [historyScopedRows]);
  const historyFiltered = useMemo(() => {
    const q = historySearchNamaPelanggan.trim().toLowerCase();
    if (!q) return historyAll;
    return historyAll.filter((r) => r.namaPelanggan.toLowerCase().includes(q));
  }, [historyAll, historySearchNamaPelanggan]);
  const historyShown = useMemo(() => historyFiltered.slice(0, HISTORY_ROWS_LIMIT), [historyFiltered]);

  const trendRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // --- Drill-down modals ---------------------------------------------
  const [dateDetail, setDateDetail] = useState<string | null>(null); // day label, e.g. "12 Agu"
  const dateDetailData = useMemo(() => {
    if (!dateDetail) return null;
    const point = trend.find((t) => t.label === dateDetail);
    if (!point) return null;
    const rows = filtered.filter((r) => r.tanggalStr === point.tanggalStr);
    return {
      nominal: point.nominal,
      ao: point.ao,
      topItems: itemsBySupplierQty(rows).slice(0, 8),
    };
  }, [dateDetail, trend, filtered]);

  const [itemDetail, setItemDetail] = useState<{ namaBarang: string; supp: string } | null>(null);
  const itemDetailData = useMemo(() => {
    if (!itemDetail) return null;
    return historyAll
      .filter((r) => r.namaBarang === itemDetail.namaBarang && r.supp === itemDetail.supp)
      .slice(0, 12);
  }, [itemDetail, historyAll]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <TopBar
        title="Omset Harian"
        subtitle={`${depoLabel(filters.depo)} · ${bulanLabel(filters.bulan)} ${tahunLabel(filters.tahun)}${tanggal.length ? ` · Tgl ${tanggal.join(', ')}` : ''}`}
      />
      <div id="page-content" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          <KpiCard label="Total Omset" value={formatRupiah(totalOmset)} icon={Wallet} />
          <KpiCard label="Total Qty Terjual" value={formatNumber(totalQty)} icon={PackageSearch} />
          <KpiCard label="Total Active Outlet" value={`${formatNumber(totalAO)} Outlet`} icon={Store} />
          <KpiCard label="Jumlah Hari Transaksi" value={`${formatNumber(jumlahHari)} Hari`} icon={CalendarClock} />
        </div>

        <Tabs tabs={HARIAN_TABS} storageKey="omset-harian">
        <TabPanel id="grafik">
        <div id="sec-omset-harian" className="card p-5 scroll-mt-28" ref={trendRef}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
            <div>
              <h3 className="font-bold text-sm">Grafik Omset Harian</h3>
              <p className="text-xs text-ink-400">
                Total omset per tanggal faktur{filters.depo.length ? ` · ${depoLabel(filters.depo)}` : ''}{filters.supp.length ? ` · ${filters.supp.join(', ')}` : ''}{filters.dsr && filters.dsr.length ? ` · ${filters.dsr.join(', ')}` : ''} · {bulanLabel(filters.bulan)} · {tahunLabel(filters.tahun)}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-40">
                <MultiSelect
                  label="Tanggal"
                  options={tanggalOptions.map((t) => ({ value: String(t), label: `Tgl ${t}` }))}
                  selected={tanggal.map(String)}
                  onChange={(v) => setTanggal(v.map(Number))}
                  allLabel="Semua Tanggal"
                />
              </div>
              <ExportMenu targetRef={trendRef} filename="grafik-omset-harian" />
            </div>
          </div>
          <div className="mt-3">
            <BarChartCard
              data={trend.map((d) => ({ label: d.label, Omset: d.nominal }))}
              xKey="label"
              series={[{ key: 'Omset', color: '#2563eb', name: 'Omset' }]}
              height={320}
              angledLabels
              minWidth={trend.length > 20 ? trend.length * 46 : undefined}
              onItemClick={setDateDetail}
            />
          </div>
          <p className="text-[11px] text-ink-400 mt-2">
            Gunakan filter <strong>SUPP</strong>, <strong>Depo</strong>, dan <strong>Sales DSR</strong> di tombol Filter (atas) untuk mempersempit grafik ini — filter Tanggal di atas hanya tersedia di halaman ini. Klik salah satu bar untuk melihat barang terlaris di tanggal tersebut.
          </p>
        </div>
        </TabPanel>

        <TabPanel id="barang">
        <div id="sec-barang-terlaris" className="card p-5 scroll-mt-28" ref={itemsRef}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-bold text-sm">Barang Paling Banyak Diambil</h3>
              <p className="text-xs text-ink-400">
                Top {TOP_ITEMS_LIMIT} barang berdasarkan akumulasi Nominal per Supplier, dengan filter yang sama seperti grafik omset harian di atas
              </p>
            </div>
            <ExportMenu targetRef={itemsRef} filename="barang-paling-banyak-diambil" />
          </div>
          <div className="mt-3">
            <BarChartCard
              data={topItems.map((it) => ({ label: `${it.namaBarang} (${it.supp})`, Nominal: it.nominal }))}
              xKey="label"
              series={[{ key: 'Nominal', color: '#16a34a', name: 'Nominal' }]}
              valueFormatter={(v) => formatRupiah(v)}
              horizontal
              height={Math.max(320, topItems.length * 34)}
              onItemClick={(label) => {
                const match = topItems.find((it) => `${it.namaBarang} (${it.supp})` === label);
                if (match) setItemDetail({ namaBarang: match.namaBarang, supp: match.supp });
              }}
            />
          </div>
          <p className="text-[11px] text-ink-400 mt-2">Klik salah satu bar untuk melihat pelanggan mana yang paling banyak mengambil barang tersebut.</p>

          <div className="flex items-center justify-between mt-5 mb-1">
            <p className="text-[11px] text-ink-400">
              Tabel rincian semua barang ({formatNumber(itemRows.length)} baris), diurutkan dari Nominal tertinggi — gulir di dalam tabel untuk melihat semua.
            </p>
          </div>
          <div className="overflow-auto mt-1 max-h-[420px] border border-ink-100 dark:border-ink-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white dark:bg-ink-900">
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3 pl-3">Supplier</th>
                  <th className="py-2 pr-3">Nama Barang</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((r) => (
                  <tr
                    key={`${r.supp}__${r.namaBarang}`}
                    onClick={() => setItemDetail({ namaBarang: r.namaBarang, supp: r.supp })}
                    className="border-b border-ink-50 dark:border-ink-800/60 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/60"
                  >
                    <td className="py-2 pr-3 pl-3 font-semibold">{r.supp}</td>
                    <td className="py-2 pr-3">{r.namaBarang}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(r.qty)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatRupiah(r.nominal)}</td>
                  </tr>
                ))}
                {itemRows.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-ink-400">Tidak ada data untuk filter ini</td></tr>
                )}
              </tbody>
              {itemRows.length > 0 && (
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="border-t-2 border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 font-extrabold">
                    <td className="py-2.5 pr-3 pl-3" colSpan={2}>Grand Total</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(itemTotalQty)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(itemTotalNominal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        </TabPanel>

        <TabPanel id="riwayat">
        <div id="sec-riwayat-pengambilan" className="card p-5 scroll-mt-28" ref={historyRef}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="font-bold text-sm">Riwayat Pengambilan Barang</h3>
              <p className="text-xs text-ink-400">
                Per kombinasi pelanggan &amp; barang{filters.depo.length ? ` · ${depoLabel(filters.depo)}` : ''}{filters.supp.length ? ` · ${filters.supp.join(', ')}` : ''} · {bulanLabel(filters.bulan)} · {tahunLabel(filters.tahun)} (transaksi terakhir)
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-44">
                <span className="block text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">Cari No Faktur</span>
                <input
                  type="text"
                  value={historySearchNoFaktur}
                  onChange={(e) => setHistorySearchNoFaktur(e.target.value)}
                  placeholder="mis. INV/2026/..."
                  className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="w-full sm:w-40">
                <span className="block text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">Cari KD Pelanggan</span>
                <input
                  type="text"
                  value={historySearchKdPelanggan}
                  onChange={(e) => setHistorySearchKdPelanggan(e.target.value)}
                  placeholder="mis. C001..."
                  className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="w-full sm:w-56">
                <span className="block text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1">Cari Nama Pelanggan</span>
                <input
                  type="text"
                  value={historySearchNamaPelanggan}
                  onChange={(e) => setHistorySearchNamaPelanggan(e.target.value)}
                  placeholder="mis. TOKO SUMBER..."
                  className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="w-full sm:w-40">
                <MultiSelect
                  label="Tanggal"
                  options={tanggalOptions.map((t) => ({ value: String(t), label: `Tgl ${t}` }))}
                  selected={tanggal.map(String)}
                  onChange={(v) => setTanggal(v.map(Number))}
                  allLabel="Semua Tanggal"
                />
              </div>
              <div className="w-full sm:w-40">
                <MultiSelect
                  label="Depo"
                  options={depoOptions.map((d) => ({ value: d, label: d }))}
                  selected={filters.depo}
                  onChange={filters.setDepo}
                  allLabel="Semua Depo"
                />
              </div>
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Supp"
                  options={suppOptions.map((s) => ({ value: s, label: s }))}
                  selected={filters.supp}
                  onChange={filters.setSupp}
                  allLabel="Semua Supplier"
                />
              </div>
              <div className="w-full sm:w-40">
                <MultiSelect
                  label="Bulan"
                  options={MONTH_NAMES_FULL_ID.map((m, i) => ({ value: String(i + 1), label: m }))}
                  selected={filters.bulan.map(String)}
                  onChange={(v) => filters.setBulan(v.map(Number))}
                  allLabel="Semua Bulan (YTD)"
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
              <ExportMenu targetRef={historyRef} filename="riwayat-pengambilan-barang" />
            </div>
          </div>

          <p className="text-[11px] text-ink-400 mb-2">
            Filter Tanggal/Depo/Supp/Bulan/Tahun di atas berlaku untuk seluruh halaman Omset Harian; diurutkan dari nominal tertinggi, gulir di dalam tabel untuk melihat semua — menampilkan {formatNumber(historyShown.length)} dari {formatNumber(historyFiltered.length)} baris.
          </p>

          <div className="overflow-auto mt-1 max-h-[420px] border border-ink-100 dark:border-ink-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white dark:bg-ink-900">
                <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-1.5 pr-3 pl-3">No Faktur</th>
                  <th className="py-1.5 pr-3">Kode Pelanggan</th>
                  <th className="py-1.5 pr-3">Nama Pelanggan</th>
                  <th className="py-1.5 pr-3">Alamat</th>
                  <th className="py-1.5 pr-3">Kota</th>
                  <th className="py-1.5 pr-3">Depo</th>
                  <th className="py-1.5 pr-3">Nama Barang</th>
                  <th className="py-1.5 pr-3">Supplier</th>
                  <th className="py-1.5 pr-3">Salesman</th>
                  <th className="py-1.5 pr-3">Transaksi Terakhir</th>
                  <th className="py-1.5 pr-3 text-right">Total Qty</th>
                  <th className="py-1.5 pr-3 text-right">Total Nominal</th>
                  <th className="py-1.5 pr-3 text-right">Frekuensi</th>
                </tr>
              </thead>
              <tbody>
                {historyShown.map((r) => (
                  <tr key={`${r.kodePelanggan}__${r.namaBarang}`} className="border-b border-ink-50 dark:border-ink-800/60">
                    <td className="py-1.5 pr-3 pl-3 whitespace-nowrap">{r.lastNoFaktur || '-'}</td>
                    <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{r.kodePelanggan}</td>
                    <td className="py-1.5 pr-3">{r.namaPelanggan}</td>
                    <td className="py-1.5 pr-3 max-w-[220px] truncate" title={r.alamat}>{r.alamat}</td>
                    <td className="py-1.5 pr-3">{r.kota}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.depo}</td>
                    <td className="py-1.5 pr-3">{r.namaBarang}</td>
                    <td className="py-1.5 pr-3">{r.supp}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.salesman}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatTanggalPendek(r.lastTransaction)}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">{formatNumber(r.totalQty)}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold whitespace-nowrap">{formatRupiah(r.totalNominal)}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">{formatNumber(r.frekuensi)}</td>
                  </tr>
                ))}
                {historyShown.length === 0 && (
                  <tr><td colSpan={13} className="py-6 text-center text-ink-400">Tidak ada data untuk filter ini</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-ink-400 mt-2">
            Kolom "No Faktur", "Depo", dan "Salesman" menampilkan data dari transaksi paling baru untuk kombinasi pelanggan &amp; barang tersebut (satu baris di sini bisa merangkum beberapa faktur berbeda). Filter "Cari No Faktur" &amp; "Cari KD Pelanggan" menyaring baris faktur sebelum diringkas, sedangkan "Cari Nama Pelanggan" menyaring hasil ringkasannya — jadi ketiganya bisa dipakai untuk menelusuri satu transaksi/pelanggan tertentu secara spesifik.
          </p>
        </div>
        </TabPanel>
        </Tabs>
      </div>

      <DetailModal
        open={!!dateDetail}
        onClose={() => setDateDetail(null)}
        title={`Rincian Tanggal: ${dateDetail ?? ''}`}
        subtitle={`${depoLabel(filters.depo)} · ${bulanLabel(filters.bulan)} ${tahunLabel(filters.tahun)}`}
      >
        {dateDetailData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                <p className="text-[11px] text-ink-400 font-semibold">Omset</p>
                <p className="text-lg font-extrabold text-brand-600">{formatRupiah(dateDetailData.nominal)}</p>
              </div>
              <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                <p className="text-[11px] text-ink-400 font-semibold">Active Outlet</p>
                <p className="text-lg font-extrabold">{formatNumber(dateDetailData.ao)} Outlet</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold mb-2">Barang Terlaris Tanggal Ini</p>
              <div className="space-y-1">
                {dateDetailData.topItems.map((it) => (
                  <div key={`${it.supp}__${it.namaBarang}`} className="flex items-center justify-between text-sm py-1 border-b border-ink-50 dark:border-ink-800/60">
                    <span className="font-medium">{it.namaBarang} <span className="text-ink-400 font-normal">({it.supp})</span></span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-ink-400 text-xs">{formatNumber(it.qty)} qty</span>
                      <span className="font-semibold">{formatRupiah(it.nominal)}</span>
                    </span>
                  </div>
                ))}
                {dateDetailData.topItems.length === 0 && <p className="text-xs text-ink-400">Tidak ada data</p>}
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={!!itemDetail}
        onClose={() => setItemDetail(null)}
        title={`Pelanggan Teratas: ${itemDetail?.namaBarang ?? ''}`}
        subtitle={itemDetail ? `Supplier: ${itemDetail.supp}` : undefined}
      >
        {itemDetailData && (
          <div className="space-y-1">
            {itemDetailData.map((r) => (
              <div key={r.kodePelanggan} className="flex items-center justify-between text-sm py-1.5 border-b border-ink-50 dark:border-ink-800/60">
                <span className="font-medium truncate pr-2">{r.namaPelanggan}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-ink-400 text-xs">{formatNumber(r.totalQty)} qty</span>
                  <span className="font-semibold">{formatRupiah(r.totalNominal)}</span>
                </span>
              </div>
            ))}
            {itemDetailData.length === 0 && <p className="text-xs text-ink-400">Tidak ada data untuk barang ini</p>}
          </div>
        )}
      </DetailModal>
    </div>
  );
}
