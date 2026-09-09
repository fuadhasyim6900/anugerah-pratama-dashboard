import type { SalesRow } from './types';
import { MONTH_NAMES_ID } from './types';

// -----------------------------------------------------------------------
// Filter Quartal (kuartal) — khusus halaman Performa Outlet, dipakai DI ATAS
// filter global Depo/Supplier/Tahun di sidebar (mis. Tahun = 2026, Quartal =
// Q1 & Q2 untuk melihat performa semester 1 saja).
// -----------------------------------------------------------------------
export const QUARTAL_OPTIONS = [
  { value: '1', label: 'Q1 (Jan - Mar)' },
  { value: '2', label: 'Q2 (Apr - Jun)' },
  { value: '3', label: 'Q3 (Jul - Sep)' },
  { value: '4', label: 'Q4 (Okt - Des)' },
];

export function quartalOfMonth(monthNum: number): number {
  if (monthNum >= 1 && monthNum <= 3) return 1;
  if (monthNum >= 4 && monthNum <= 6) return 2;
  if (monthNum >= 7 && monthNum <= 9) return 3;
  if (monthNum >= 10 && monthNum <= 12) return 4;
  return 0;
}

export function filterByQuartal(rows: SalesRow[], quartal: number[]): SalesRow[] {
  if (!quartal.length) return rows;
  return rows.filter((r) => quartal.includes(quartalOfMonth(r.monthNum)));
}

// -----------------------------------------------------------------------
// Filter Kode Toko (kode pelanggan/outlet) — juga khusus halaman ini.
// -----------------------------------------------------------------------
export function filterByKodeToko(rows: SalesRow[], kodeToko: string[]): SalesRow[] {
  if (!kodeToko.length) return rows;
  return rows.filter((r) => kodeToko.includes(r.kodePelanggan));
}

export interface KodeTokoOption {
  value: string; // kodePelanggan — sama untuk kedua daftar di bawah (Kode Toko & Nama Pelanggan
  label: string; // cuma menyaring/menampilkan toko yang sama dari dua sudut pencarian berbeda)
}

function distinctTokoMap(rows: SalesRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (!r.kodePelanggan) continue;
    if (!map.has(r.kodePelanggan)) map.set(r.kodePelanggan, r.namaPelanggan || '');
  }
  return map;
}

// Daftar pilihan "Kode Toko" (diurutkan berdasarkan kode) yang tersedia pada
// baris yang diberikan (biasanya sudah disaring Depo/Sales/Supplier/Tahun).
export function distinctKodeTokoOptions(rows: SalesRow[]): KodeTokoOption[] {
  return Array.from(distinctTokoMap(rows).entries())
    .map(([value, nama]) => ({ value, label: nama ? `${value} - ${nama}` : value }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

// Daftar pilihan "Nama Pelanggan" — value-nya SAMA PERSIS dengan Kode Toko
// (satu toko = satu kodePelanggan), hanya label & urutannya diprioritaskan
// untuk pencarian berdasarkan nama supaya lebih mudah menemukan toko kalau
// yang diingat cuma namanya, bukan kodenya. Memilih dari daftar ini atau
// dari daftar Kode Toko sama-sama mengisi filter "Kode Toko" yang sama.
export function distinctNamaPelangganOptions(rows: SalesRow[]): KodeTokoOption[] {
  return Array.from(distinctTokoMap(rows).entries())
    .map(([value, nama]) => ({ value, label: nama ? `${nama} (${value})` : value }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// -----------------------------------------------------------------------
// Grafik "Performa Outlet": sumbu X = Januari..Desember, satu garis (line)
// per Tahun yang muncul pada data, nilainya akumulasi Nominal per bulan
// (bulan/tahun diturunkan dari TGL FAKTUR). Bulan yang tidak punya transaksi
// (mis. karena kena filter Quartal) tetap muncul di sumbu X dengan nilai 0,
// supaya sumbu X selalu lengkap Jan-Des.
// -----------------------------------------------------------------------
export interface OutletPerformanceTrend {
  data: Record<string, string | number>[]; // [{ bulan: 'Jan', '2025': 12000000, '2026': 15000000 }, ...]
  years: number[];
}

export function outletPerformanceTrend(rows: SalesRow[]): OutletPerformanceTrend {
  const years = Array.from(new Set(rows.map((r) => r.tahun).filter((y) => y))).sort((a, b) => a - b);
  const map = new Map<number, Map<number, number>>(); // monthNum -> tahun -> nominal
  for (let m = 1; m <= 12; m++) map.set(m, new Map());
  for (const r of rows) {
    if (!r.monthNum || r.monthNum < 1 || r.monthNum > 12 || !r.tahun) continue;
    const monthMap = map.get(r.monthNum)!;
    monthMap.set(r.tahun, (monthMap.get(r.tahun) || 0) + r.nominal);
  }
  const data = Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1;
    const row: Record<string, string | number> = { bulan: MONTH_NAMES_ID[i] };
    const monthMap = map.get(monthNum)!;
    for (const y of years) row[String(y)] = monthMap.get(y) || 0;
    return row;
  });
  return { data, years };
}

// Palet warna line per tahun — cukup untuk beberapa tahun sekaligus, diulang
// kalau tahunnya lebih banyak dari palet.
export const YEAR_LINE_COLORS = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

// -----------------------------------------------------------------------
// Barchart horizontal "Performa Supplier": akumulasi Nominal per Supplier,
// dari baris yang SAMA dengan yang dipakai grafik Performa Outlet (jadi ikut
// berubah kalau filter Depo/Supplier/Kode Toko/Tahun/Quartal di atas
// diganti), diurutkan dari nominal tertinggi.
// -----------------------------------------------------------------------
export interface SupplierPerformanceRow {
  supplier: string;
  nominal: number;
}

export function supplierPerformanceBars(rows: SalesRow[]): SupplierPerformanceRow[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.supp || '(Kosong)';
    map.set(key, (map.get(key) || 0) + r.nominal);
  }
  return Array.from(map.entries())
    .map(([supplier, nominal]) => ({ supplier, nominal }))
    .sort((a, b) => b.nominal - a.nominal);
}

// -----------------------------------------------------------------------
// Popup daftar barang saat bar Supplier diklik: daftar Nama Barang yang
// dibeli untuk supplier tsb, dari baris yang sama (sudah kena semua filter
// halaman ini), diurutkan dari Nominal tertinggi.
// -----------------------------------------------------------------------
export interface SupplierItemRow {
  namaBarang: string;
  qty: number;
  nominal: number;
}

// Filter Bulan lokal di dalam popup "Daftar Barang" (terpisah dari filter
// Quartal di halaman utama) — supaya orang bisa mempersempit daftar barang
// ke bulan tertentu tanpa mengubah grafik Performa Outlet di belakangnya.
export function filterByBulanPopup(rows: SalesRow[], bulan: number[]): SalesRow[] {
  if (!bulan.length) return rows;
  return rows.filter((r) => bulan.includes(r.monthNum));
}

export function itemsForSupplier(rows: SalesRow[], supplier: string): SupplierItemRow[] {
  const map = new Map<string, SupplierItemRow>();
  for (const r of rows) {
    const supKey = r.supp || '(Kosong)';
    if (supKey !== supplier) continue;
    if (!r.namaBarang) continue;
    const entry = map.get(r.namaBarang) || { namaBarang: r.namaBarang, qty: 0, nominal: 0 };
    entry.qty += r.qty;
    entry.nominal += r.nominal;
    map.set(r.namaBarang, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.nominal - a.nominal);
}
