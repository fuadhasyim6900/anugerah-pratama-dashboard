import { useMemo, useRef } from 'react';
import { Wallet, Target, Percent, Landmark } from 'lucide-react';
import TopBar from '../components/TopBar';
import KpiCard from '../components/KpiCard';
import BarChartCard from '../components/charts/BarChartCard';
import ComboChartCard from '../components/charts/ComboChartCard';
import ExportMenu from '../components/ExportMenu';
import { useSalesData } from '../hooks/useSalesData';
import { useFilterStore } from '../store/filters';
import {
  applyUangMasukFilters, sumTargetPiutang, sumRealisasiPiutang,
  uangMasukTrendByMonth, uangMasukByDepo,
  formatRupiah, depoLabel, bulanLabel, tahunLabel,
} from '../lib/aggregate';
import { LoadingState, ErrorState } from './ExecutiveDashboard';

export default function RealisasiUangMasuk() {
  const { uangMasuk, loading, error } = useSalesData();
  const filters = useFilterStore();

  // Depo & Tahun mengikuti filter sidebar seperti halaman lain. Bulan juga
  // ikut filter sidebar untuk KPI & tabel per depo, tapi grafik tren bulanan
  // sengaja mengabaikannya (sama seperti "Target vs Realisasi" di Executive
  // Dashboard) supaya trennya tetap terlihat penuh.
  const filtered = useMemo(
    () => applyUangMasukFilters(uangMasuk, { depo: filters.depo, bulan: filters.bulan, tahun: filters.tahun }),
    [uangMasuk, filters.depo, filters.bulan, filters.tahun]
  );

  const totalTarget = useMemo(() => sumTargetPiutang(filtered), [filtered]);
  const totalRealisasi = useMemo(() => sumRealisasiPiutang(filtered), [filtered]);
  const selisih = totalTarget - totalRealisasi;
  const pencapaian = totalTarget ? (totalRealisasi / totalTarget) * 100 : 0;

  const trendRows = useMemo(
    () => applyUangMasukFilters(uangMasuk, { depo: filters.depo, bulan: [], tahun: filters.tahun }),
    [uangMasuk, filters.depo, filters.tahun]
  );
  const trend = useMemo(() => uangMasukTrendByMonth(trendRows), [trendRows]);

  const byDepo = useMemo(() => uangMasukByDepo(filtered), [filtered]);

  const trendRef = useRef<HTMLDivElement>(null);
  const perDepoRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  if (uangMasuk.length === 0) {
    return (
      <div>
        <TopBar title="Realisasi Uang Masuk" subtitle="Target & realisasi penagihan piutang per depo" />
        <div className="p-4 sm:p-6">
          <div className="card p-6 max-w-xl">
            <p className="font-bold text-brand-600 mb-2">Data belum tersedia</p>
            <p className="text-sm text-ink-500">
              Tabel <code>uang_masuk</code> di Supabase belum dibuat atau masih kosong. Buat tabelnya lalu jalankan{' '}
              <code>node scripts/sync-data.mjs</code> untuk mengimpor data dari{' '}
              <code>REALISASI UANG MASUK.xlsx</code> — lihat bagian "Realisasi Uang Masuk" di README.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title="Realisasi Uang Masuk"
        subtitle={`${depoLabel(filters.depo)} · ${bulanLabel(filters.bulan)} ${tahunLabel(filters.tahun)}`}
      />
      <div id="page-content" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          <KpiCard label="Target Piutang" value={formatRupiah(totalTarget)} icon={Target} />
          <KpiCard label="Realisasi Piutang" value={formatRupiah(totalRealisasi)} icon={Wallet} />
          <KpiCard
            label="Persentase Pencapaian"
            value={`${pencapaian.toFixed(1)}%`}
            icon={Percent}
            accent={pencapaian >= 100 ? 'brand' : 'ink'}
          />
          <KpiCard
            label={selisih >= 0 ? 'Kekurangan dari Target' : 'Melebihi Target'}
            value={formatRupiah(Math.abs(selisih))}
            icon={Landmark}
            accent={selisih > 0 ? 'ink' : 'brand'}
          />
        </div>

        <div id="sec-tren-uang-masuk" className="card p-5 scroll-mt-28" ref={trendRef}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-bold text-sm">Tren Target vs Realisasi Piutang Bulanan</h3>
            <ExportMenu targetRef={trendRef} filename="tren-target-vs-realisasi-piutang" />
          </div>
          <p className="text-xs text-ink-400 mb-3">
            Perbandingan target dan realisasi penagihan piutang setiap bulan{filters.depo.length ? ` · ${depoLabel(filters.depo)}` : ''} · {tahunLabel(filters.tahun)}
          </p>
          <ComboChartCard
            data={trend}
            xKey="bulan"
            bars={[
              { key: 'Target', color: '#d9d9de', name: 'Target Piutang' },
              { key: 'Realisasi', color: '#b91c1c', name: 'Realisasi Piutang' },
            ]}
            lines={[{ key: 'Realisasi', color: '#2563eb', name: 'Realisasi (Tren)' }]}
            pctLabel={{ valueKey: 'Realisasi', targetKey: 'Target' }}
          />
        </div>

        <div id="sec-uang-masuk-per-depo" className="card p-5 scroll-mt-28" ref={perDepoRef}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-bold text-sm">Realisasi Piutang per Depo</h3>
            <ExportMenu targetRef={perDepoRef} filename="realisasi-piutang-per-depo" />
          </div>
          <p className="text-xs text-ink-400 mb-3">
            Target vs realisasi penagihan piutang di setiap depo · {bulanLabel(filters.bulan)} · {tahunLabel(filters.tahun)}
          </p>
          <BarChartCard
            data={byDepo.rows.map((d) => ({ label: d.depo, Target: d.target, Realisasi: d.realisasi }))}
            xKey="label"
            series={[
              { key: 'Target', color: '#d9d9de', name: 'Target' },
              { key: 'Realisasi', color: '#b91c1c', name: 'Realisasi' },
            ]}
            pctLabel={{ valueKey: 'Realisasi', targetKey: 'Target' }}
            height={340}
          />
        </div>

        <div id="sec-tabel-uang-masuk-per-depo" className="card p-5 scroll-mt-28" ref={tableRef}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-bold text-sm">Tabel Rincian per Depo</h3>
              <p className="text-xs text-ink-400">
                Target, realisasi, dan persentase pencapaian penagihan piutang per depo{filters.depo.length ? ` · ${depoLabel(filters.depo)}` : ''} · {bulanLabel(filters.bulan)} · {tahunLabel(filters.tahun)}
              </p>
            </div>
            <ExportMenu targetRef={tableRef} filename="tabel-realisasi-uang-masuk-per-depo" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                  <th className="py-2 pr-3">Depo</th>
                  <th className="py-2 pr-3 text-right">Target Piutang</th>
                  <th className="py-2 pr-3 text-right">Realisasi Piutang</th>
                  <th className="py-2 pr-3 text-right">Pencapaian (%)</th>
                </tr>
              </thead>
              <tbody>
                {byDepo.rows.map((r) => (
                  <tr key={r.depo} className="border-b border-ink-50 dark:border-ink-800/60">
                    <td className="py-2 pr-3 font-semibold">{r.depo}</td>
                    <td className="py-2 pr-3 text-right">{formatRupiah(r.target)}</td>
                    <td className="py-2 pr-3 text-right">{formatRupiah(r.realisasi)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${r.pencapaianPct === null ? 'text-ink-400' : r.pencapaianPct >= 100 ? 'text-emerald-600' : 'text-brand-600'}`}>
                      {r.pencapaianPct === null ? '-' : `${r.pencapaianPct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {byDepo.rows.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-ink-400">Tidak ada data untuk filter ini</td></tr>
                )}
                {byDepo.rows.length > 0 && (
                  <tr className="border-t-2 border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 font-extrabold">
                    <td className="py-2.5 pr-3">Grand Total</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(byDepo.grandTotal.target)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(byDepo.grandTotal.realisasi)}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {byDepo.grandTotal.pencapaianPct === null ? '-' : `${byDepo.grandTotal.pencapaianPct.toFixed(1)}%`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
