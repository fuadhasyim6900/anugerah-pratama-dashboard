import type { SalesRow } from './types';
import { distinctCount, maxOf, pctChange, sumNominal } from './aggregate';

// -----------------------------------------------------------------------
// Filter tanggal (hari dalam bulan, 1-31) khusus halaman Omset Harian —
// dipakai DI ATAS filter global (Depo/Sales/SUPP/Bulan/Tahun) di sidebar,
// jadi bisa "Bulan = Agustus, Tanggal = 5,6,7" untuk melihat omset di
// tanggal-tanggal tertentu saja.
// -----------------------------------------------------------------------
export function filterByTanggal(rows: SalesRow[], tanggal: number[]): SalesRow[] {
  if (!tanggal.length) return rows;
  return rows.filter((r) => tanggal.includes(r.tanggal));
}

export function distinctTanggalPresent(rows: SalesRow[]): number[] {
  return Array.from(new Set(rows.map((r) => r.tanggal)))
    .filter((t) => t >= 1 && t <= 31)
    .sort((a, b) => a - b);
}

export interface DailyPoint {
  tanggalStr: string; // "yyyy-mm-dd"
  label: string;       // "12 Agu"
  nominal: number;
  ao: number;
}

const DAY_LABEL_FMT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' });

// Tren omset per hari (tanggal faktur), diurutkan dari tanggal paling awal.
export function dailyTrend(rows: SalesRow[]): DailyPoint[] {
  const map = new Map<string, { nominal: number; ao: Set<string>; date: Date }>();
  for (const r of rows) {
    if (!r.tanggalStr || !r.tglFaktur) continue;
    const entry = map.get(r.tanggalStr) || { nominal: 0, ao: new Set<string>(), date: r.tglFaktur };
    entry.nominal += r.nominal;
    entry.ao.add(r.kdGrup);
    map.set(r.tanggalStr, entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tanggalStr, v]) => ({
      tanggalStr,
      label: DAY_LABEL_FMT.format(v.date),
      nominal: v.nominal,
      ao: v.ao.size,
    }));
}

export interface ItemQtyRow {
  supp: string;
  namaBarang: string;
  qty: number;
  nominal: number;
}

// Akumulasi Qty & Nominal per (SUPP + Nama Barang) — dipakai untuk barchart
// "Barang Paling Banyak Diambil" (top N) sekaligus tabel rinciannya (semua
// baris). Diurutkan berdasarkan akumulasi NOMINAL (bukan Qty) supaya barang
// dengan nilai transaksi terbesar yang tampil di atas.
export function itemsBySupplierQty(rows: SalesRow[]): ItemQtyRow[] {
  const map = new Map<string, ItemQtyRow>();
  for (const r of rows) {
    if (!r.namaBarang) continue;
    const key = `${r.supp || '(Kosong)'}__${r.namaBarang}`;
    const entry = map.get(key) || { supp: r.supp || '(Kosong)', namaBarang: r.namaBarang, qty: 0, nominal: 0 };
    entry.qty += r.qty;
    entry.nominal += r.nominal;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.nominal - a.nominal);
}

export interface CustomerHistoryRow {
  kodePelanggan: string;
  namaPelanggan: string;
  alamat: string;
  kota: string;
  depo: string;
  namaBarang: string;
  supp: string;
  salesman: string;
  lastTransaction: Date;
  lastNoFaktur: string;
  totalQty: number;
  totalNominal: number;
  frekuensi: number; // jumlah transaksi (baris faktur) berbeda
}

// Riwayat pengambilan barang: satu baris per kombinasi Pelanggan + Barang,
// diringkas dari seluruh baris faktur yang cocok. lastNoFaktur/depo/salesman
// berasal dari transaksi PALING BARU untuk kombinasi tersebut.
export function customerPurchaseHistory(rows: SalesRow[]): CustomerHistoryRow[] {
  const map = new Map<string, CustomerHistoryRow>();
  for (const r of rows) {
    if (!r.kodePelanggan || !r.namaBarang || !r.tglFaktur) continue;
    const key = `${r.kodePelanggan}__${r.namaBarang}`;
    const entry = map.get(key);
    if (!entry) {
      map.set(key, {
        kodePelanggan: r.kodePelanggan,
        namaPelanggan: r.namaPelanggan,
        alamat: r.alamatPelanggan,
        kota: r.kota,
        depo: r.depo,
        namaBarang: r.namaBarang,
        supp: r.supp,
        salesman: r.sales,
        lastTransaction: r.tglFaktur,
        lastNoFaktur: r.noFaktur,
        totalQty: r.qty,
        totalNominal: r.nominal,
        frekuensi: 1,
      });
    } else {
      entry.totalQty += r.qty;
      entry.totalNominal += r.nominal;
      entry.frekuensi += 1;
      if (r.tglFaktur > entry.lastTransaction) {
        entry.lastTransaction = r.tglFaktur;
        entry.lastNoFaktur = r.noFaktur;
        entry.depo = r.depo;
        entry.salesman = r.sales;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalNominal - a.totalNominal);
}

export interface DailyComparisonRow {
  tanggal: number;
  label: string; // "Tgl 1", dst
  salesA: number;
  salesB: number;
  salesGrowth: number | null;
  aoA: number;
  aoB: number;
  aoGrowth: number | null;
}

export interface DailyComparisonResult {
  rows: DailyComparisonRow[];
  grandTotal: DailyComparisonRow | null;
}

// Sama seperti "Tabel Rincian Perbandingan Bulanan" di Executive Dashboard,
// tapi per tanggal DI DALAM bulan tertentu, untuk dua kombinasi Bulan+Tahun
// yang independen (Bulan A/Tahun A vs Bulan B/Tahun B) — jadi bisa
// membandingkan mis. "Juli 2025" vs "Agustus 2026". rowsA/rowsB harus sudah
// difilter Depo/Supp/DSR sesuai kebutuhan, TANPA filter bulan/tahun (bulan &
// tahun ditentukan di sini).
export function dailyComparisonForMonth(
  rows: SalesRow[],
  bulanA: number,
  tahunA: number | null,
  bulanB: number,
  tahunB: number | null
): DailyComparisonResult {
  if (tahunA === null || tahunB === null) return { rows: [], grandTotal: null };

  const rowsA = rows.filter((r) => r.monthNum === bulanA && r.tahun === tahunA);
  const rowsB = rows.filter((r) => r.monthNum === bulanB && r.tahun === tahunB);

  const daysInMonth = Math.max(
    new Date(tahunA, bulanA, 0).getDate(),
    new Date(tahunB, bulanB, 0).getDate()
  );

  const out: DailyComparisonRow[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const aRows = rowsA.filter((r) => r.tanggal === d);
    const bRows = rowsB.filter((r) => r.tanggal === d);
    const salesA = sumNominal(aRows);
    const salesB = sumNominal(bRows);
    const aoA = distinctCount(aRows, 'kdGrup');
    const aoB = distinctCount(bRows, 'kdGrup');
    out.push({
      tanggal: d,
      label: `Tgl ${d}`,
      salesA, salesB,
      salesGrowth: pctChange(salesB, salesA),
      aoA, aoB,
      aoGrowth: pctChange(aoB, aoA),
    });
  }

  const grandSalesA = sumNominal(rowsA);
  const grandSalesB = sumNominal(rowsB);
  const grandAoA = distinctCount(rowsA, 'kdGrup');
  const grandAoB = distinctCount(rowsB, 'kdGrup');

  return {
    rows: out,
    grandTotal: {
      tanggal: 0,
      label: 'Grand Total',
      salesA: grandSalesA, salesB: grandSalesB,
      salesGrowth: pctChange(grandSalesB, grandSalesA),
      aoA: grandAoA, aoB: grandAoB,
      aoGrowth: pctChange(grandAoB, grandAoA),
    },
  };
}

export function formatTanggalPendek(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Aman untuk array besar — lihat catatan di aggregate.ts (maxOf).
export function maxTahunPresent(rows: SalesRow[]): number {
  return maxOf(rows.map((r) => r.tahun), new Date().getFullYear());
}
