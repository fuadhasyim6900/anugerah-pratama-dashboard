import { supabase, supabaseConfigError } from './supabaseClient';
import type { SalesRow, TargetRow, UangMasukRow } from './types';
import { normalizeBulanToMonthNum } from './types';

// Data sekarang disimpan di Supabase (tabel `sales` dan `targets`), bukan lagi
// di file Excel dalam repo. Untuk update data harian, edit langsung lewat
// Supabase Table Editor / SQL Editor, atau lewat script import terpisah —
// TIDAK perlu commit/push/redeploy lagi.

const PAGE_SIZE = 1000; // batas default PostgREST per request (naikkan lewat
// Supabase Dashboard -> Settings -> API -> "Max Rows" kalau ingin lebih besar)

// Sebelumnya versi ini mengambil data per halaman SECARA BERURUTAN (satu
// request nunggu selesai baru request berikutnya jalan) — untuk tabel besar
// seperti `sales` (~260rb baris = ~261 request) ini bikin loading awal lama.
// Sekarang: hitung dulu total baris, lalu ambil SEMUA halaman SECARA
// PARALEL sekaligus, jauh lebih cepat.
async function fetchAllRows<T>(
  table: string,
  columns: string
): Promise<T[]> {
  // Baru dicek di sini (bukan saat modul di-import) supaya kalau env belum
  // diset, errornya tertangkap oleh try/catch di useSalesData.tsx dan
  // ditampilkan lewat <ErrorState />, bukan bikin app gagal mount total.
  if (supabaseConfigError) throw new Error(supabaseConfigError);

  // 1. Hitung total baris dulu (request ringan, tidak ambil data)
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(`Gagal menghitung jumlah baris "${table}": ${countError.message}`);
  const total = count ?? 0;
  if (total === 0) return [];

  // 2. Susun semua request halaman, lalu jalankan bersamaan lewat Promise.all
  const pageStarts: number[] = [];
  for (let from = 0; from < total; from += PAGE_SIZE) pageStarts.push(from);

  const pages = await Promise.all(
    pageStarts.map(async (from) => {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase.from(table).select(columns).range(from, to);
      if (error) throw new Error(`Gagal memuat data dari tabel "${table}": ${error.message}`);
      return (data ?? []) as unknown as T[];
    })
  );

  return pages.flat();
}

interface SalesDbRow {
  nominal: number;
  supp: string;
  depo: string;
  bulan: string;
  tahun: number;
  kd_grup: string;
  sales: string;
  kota: string;
  tele: string;
}

interface TargetDbRow {
  nama_salesman: string;
  depo: string;
  supplier: string;
  tahun: number;
  monthly: number[];
}

export async function loadSalesData(): Promise<SalesRow[]> {
  const rows = await fetchAllRows<SalesDbRow>(
    'sales',
    'nominal, supp, depo, bulan, tahun, kd_grup, sales, kota, tele'
  );

  return rows
    .map((r): SalesRow => {
      const bulanRaw = String(r.bulan ?? '').trim();
      return {
        nominal: Number(r.nominal) || 0,
        supp: String(r.supp ?? '').trim(),
        depo: String(r.depo ?? '').trim().toUpperCase(),
        bulan: bulanRaw,
        monthNum: normalizeBulanToMonthNum(bulanRaw),
        tahun: r.tahun ?? 2026,
        kdGrup: String(r.kd_grup ?? '').trim(),
        sales: String(r.sales ?? '').trim(),
        kota: String(r.kota ?? '').trim().toUpperCase(),
        tele: String(r.tele ?? '').trim(),
      };
    })
    .filter((r) => r.depo && r.sales);
}

// Waktu terakhir data di-sync ke Supabase (diisi oleh scripts/sync-data.mjs
// setiap kali Anda menjalankan sinkronisasi Excel -> database). Ini BEDA
// dengan waktu browser memuat data (yang berubah setiap refresh halaman) —
// ini adalah waktu Anda benar-benar meng-update datanya.
export async function loadDataSyncedAt(): Promise<Date | null> {
  const { data, error } = await supabase
    .from('data_meta')
    .select('synced_at')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data?.synced_at) return null;
  return new Date(data.synced_at);
}

interface UangMasukDbRow {
  tahun: number;
  bulan: string;
  depo: string;
  target_piutang: number;
  realisasi_piutang: number;
}

export async function loadUangMasukData(): Promise<UangMasukRow[]> {
  const rows = await fetchAllRows<UangMasukDbRow>(
    'uang_masuk',
    'tahun, bulan, depo, target_piutang, realisasi_piutang'
  );

  return rows
    .map((r): UangMasukRow => {
      const bulanRaw = String(r.bulan ?? '').trim();
      return {
        tahun: r.tahun ?? 2026,
        bulan: bulanRaw,
        monthNum: normalizeBulanToMonthNum(bulanRaw),
        depo: String(r.depo ?? '').trim().toUpperCase(),
        targetPiutang: Number(r.target_piutang) || 0,
        realisasiPiutang: Number(r.realisasi_piutang) || 0,
      };
    })
    .filter((r) => r.depo);
}

export async function loadTargetData(): Promise<TargetRow[]> {
  const rows = await fetchAllRows<TargetDbRow>(
    'targets',
    'nama_salesman, depo, supplier, tahun, monthly'
  );

  return rows
    .map((r): TargetRow => ({
      namaSalesman: String(r.nama_salesman ?? '').trim(),
      depo: String(r.depo ?? '').trim().toUpperCase(),
      supplier: String(r.supplier ?? '').trim().toUpperCase(),
      tahun: r.tahun ?? new Date().getFullYear(),
      monthly: Array.isArray(r.monthly) && r.monthly.length === 12
        ? r.monthly.map((v) => Number(v) || 0)
        : new Array(12).fill(0),
    }))
    .filter((r) => r.namaSalesman);
}
