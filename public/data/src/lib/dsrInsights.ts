import type { SalesRow } from './types';
import { MONTH_NAMES_ID } from './types';
import { sumNominal, groupSumBy, formatRupiah } from './aggregate';

export interface DSRInsight {
  dsr: string;
  tag: string;
  salesYtd: number;
  avgAoMonthly: number;
  weaknesses: string[];
  recommendations: string[];
}

function monthlySeries(rows: SalesRow[]): { m: number; label: string; nominal: number }[] {
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.monthNum, (map.get(r.monthNum) || 0) + r.nominal);
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([m, nominal]) => ({ m, label: MONTH_NAMES_ID[m - 1], nominal }));
}

function jt(v: number): string {
  const juta = v / 1_000_000;
  return `Rp ${juta.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jt`;
}

export function buildDSRInsight(allRowsForDepo: SalesRow[], dsr: string): DSRInsight {
  const rows = allRowsForDepo.filter((r) => r.sales === dsr);
  const salesYtd = sumNominal(rows);

  // AO bulanan rerata
  const byMonthAO = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!byMonthAO.has(r.monthNum)) byMonthAO.set(r.monthNum, new Set());
    byMonthAO.get(r.monthNum)!.add(r.kdGrup);
  }
  const aoCounts = Array.from(byMonthAO.values()).map((s) => s.size);
  const avgAoMonthly = aoCounts.length ? Math.round(aoCounts.reduce((a, b) => a + b, 0) / aoCounts.length) : 0;

  const series = monthlySeries(rows);
  const weaknesses: string[] = [];
  const recommendations: string[] = [];
  let tag = 'Kinerja Stabil';

  if (series.length >= 2) {
    // find trough (lowest point that isn't the first or last month) and see if last month recovered
    let minIdx = 0;
    for (let i = 1; i < series.length; i++) if (series[i].nominal < series[minIdx].nominal) minIdx = i;
    const first = series[0];
    const trough = series[minIdx];
    const last = series[series.length - 1];

    if (minIdx > 0 && minIdx < series.length - 1 && last.nominal > trough.nominal * 1.15) {
      tag = `Rebound di Bulan ${last.label}`;
      weaknesses.push(
        `Tren Penjualan Sempat Menurun: Omzet bulanan sempat merosot dari ${jt(first.nominal)} (${first.label}) menjadi ${jt(trough.nominal)} (${trough.label}), namun berhasil rebound ke ${jt(last.nominal)} pada bulan ${last.label}.`
      );
      recommendations.push(
        'Audit Retensi Outlet: Melakukan evaluasi kunjungan bulanan untuk mendeteksi apakah ada outlet besar (key account) yang beralih atau mengurangi volume order.'
      );
    } else if (last.nominal > first.nominal * 1.1 && trough.nominal >= first.nominal * 0.9) {
      tag = 'Tren Positif / Meningkat';
    } else if (minIdx === series.length - 1 && series.length > 2) {
      tag = 'Perlu Perhatian — Menurun di Bulan Terakhir';
      const prev = series[series.length - 2];
      weaknesses.push(
        `Penjualan Melambat: Omzet ${last.label} turun menjadi ${jt(last.nominal)}, dari ${jt(prev.nominal)} di bulan ${prev.label} sebelumnya.`
      );
      recommendations.push(
        'Investigasi Penyebab Penurunan: Melakukan pemeriksaan cepat terhadap kendala stok supplier, penagihan kredit macet, atau kendala kunjungan DSR.'
      );
    } else {
      // volatility check
      const mean = series.reduce((a, b) => a + b.nominal, 0) / series.length;
      const variance = series.reduce((a, b) => a + Math.pow(b.nominal - mean, 2), 0) / series.length;
      const cv = mean ? Math.sqrt(variance) / mean : 0;
      if (cv > 0.3) {
        tag = 'Kinerja Fluktuatif';
        weaknesses.push(
          `Pola Bulanan Tidak Stabil: Tingkat penjualan berfluktuasi cukup tinggi antar bulan (variasi ${(cv * 100).toFixed(0)}% dari rata-rata ${jt(mean)}).`
        );
        recommendations.push(
          'Penataan Rute Kunjungan: Mendesain ulang rencana kunjungan bulanan agar frekuensi order per outlet lebih konsisten.'
        );
      }
    }

    // Big single-month drop pattern (e.g. one month far below neighbours) — "kejatuhan omzet" style
    for (let i = 1; i < series.length - 1; i++) {
      const avgNeighbour = (series[i - 1].nominal + series[i + 1].nominal) / 2;
      if (avgNeighbour > 0 && series[i].nominal < avgNeighbour * 0.5) {
        weaknesses.push(
          `Kejatuhan Omzet ${series[i].label}: Penjualan merosot tajam ke ${jt(series[i].nominal)} (turun ${Math.round((1 - series[i].nominal / avgNeighbour) * 100)}% dibanding rata-rata bulan sekitarnya), sebelum kembali normal.`
        );
        recommendations.push(
          `Investigasi Penyebab Drop ${series[i].label}: Menelusuri kendala stok, penagihan, atau absennya kunjungan DSR pada bulan tersebut.`
        );
        break;
      }
    }
  }

  // Brand / supplier concentration
  const bySupplier = groupSumBy(rows, 'supp');
  const total = sumNominal(rows) || 1;
  const top2Share = bySupplier.slice(0, 2).reduce((a, b) => a + b.value, 0) / total;
  if (bySupplier.length > 2 && top2Share > 0.7) {
    const names = bySupplier.slice(0, 2).map((b) => `${b.label} (${((b.value / total) * 100).toFixed(1)}%)`).join(' dan ');
    weaknesses.push(
      `Risiko Konsentrasi Brand: Penjualan bertumpu pada ${names}, menyumbang ${(top2Share * 100).toFixed(0)}% omzet secara kumulatif.`
    );
    recommendations.push(
      'Diversifikasi Kategori Produk: Melakukan penetrasi ke brand/supplier lain dengan skema promosi perkenalan pada outlet-outlet loyal.'
    );
  }

  const smallShare = bySupplier.filter((b) => b.value / total < 0.01);
  if (smallShare.length > 0 && bySupplier.length > 3) {
    const names = smallShare.slice(0, 2).map((b) => b.label).join(' dan ');
    weaknesses.push(
      `Pasar Brand Tertentu Belum Tergarap: Penjualan untuk ${names} hampir tidak tersentuh (< 1% share).`
    );
    recommendations.push(
      'Program Perkenalan Produk: Menawarkan bundling atau insentif khusus agar outlet mau mencoba brand yang belum tergarap.'
    );
  }

  // Productivity (nominal per AO)
  const productivity = avgAoMonthly ? total / (avgAoMonthly * (series.length || 1)) : 0;

  if (weaknesses.length === 0) {
    weaknesses.push('Kinerja Terjaga: Tidak ditemukan indikasi penurunan tajam atau konsentrasi risiko yang signifikan pada periode ini.');
    recommendations.push('Pertahankan Pola Kunjungan: Melanjutkan ritme kunjungan dan strategi penjualan yang sudah berjalan baik saat ini.');
  }

  if (productivity > 0 && productivity < 1_500_000) {
    weaknesses.push(`Produktivitas per Outlet Rendah: Rata-rata penjualan sekitar ${formatRupiah(productivity)}/outlet, di bawah standar drop size yang sehat.`);
    recommendations.push('Strategi MOQ (Minimum Order Quantity): Menerapkan jumlah minimal pembelian per kunjungan untuk mendorong nilai order lebih besar.');
  }

  return {
    dsr,
    tag,
    salesYtd,
    avgAoMonthly,
    weaknesses: weaknesses.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}
