import type { SalesRow, TargetRow, UangMasukRow } from './types';
import { normalizeBulanToMonthNum } from './types';

// Data sekarang diambil lewat /api/data (Vercel Serverless Function), BUKAN
// langsung dari Supabase di browser. Alasannya soal kuota: tabel `sales`
// berisi ± 262.000 baris — kalau tiap browser sales menariknya langsung dari
// Supabase setiap kali buka halaman, kuota egress Supabase Free (5 GB/bulan)
// akan terlampaui hanya dengan traffic ringan sekalipun (lihat penjelasan di
// chat). /api/data di-cache oleh Vercel selama beberapa jam (lihat
// CACHE_SECONDS di api/data.js), jadi Supabase hanya diakses sesekali, bukan
// tiap kunjungan.

interface ApiSalesRow {
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

interface ApiTargetRow {
  nama_salesman: string;
  depo: string;
  supplier: string;
  tahun: number;
  monthly: number[];
}

interface ApiUangMasukRow {
  tahun: number;
  bulan: string;
  depo: string;
  target_piutang: number;
  realisasi_piutang: number;
}

interface ApiResponse {
  sales: ApiSalesRow[];
  targets: ApiTargetRow[];
  uangMasuk: ApiUangMasukRow[];
  syncedAt: string | null;
  error?: string;
}

// Satu request ke /api/data dipakai bersama oleh semua fungsi load*() di
// bawah (di-dedupe lewat Promise ini), jadi walau useSalesData.tsx
// memanggil 4 fungsi sekaligus lewat Promise.all, browser cuma benar-benar
// melakukan 1 kali fetch jaringan per pemuatan halaman.
let inFlight: Promise<ApiResponse> | null = null;

async function fetchApiData(): Promise<ApiResponse> {
  if (!inFlight) {
    inFlight = fetch('/api/data')
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse;
        if (!res.ok) throw new Error(json.error || `Gagal memuat data (status ${res.status})`);
        return json;
      })
      .catch((err) => {
        inFlight = null; // supaya klik "Refresh" berikutnya mencoba lagi, bukan terus gagal
        throw err;
      });
  }
  return inFlight;
}

/** Dipanggil oleh tombol Refresh supaya percobaan berikutnya fetch ulang
 * (masih akan dilayani dari cache Vercel kalau belum basi -- ini TIDAK
 * memaksa Supabase diakses ulang, cuma reset cache di level browser). */
export function resetDataCache() {
  inFlight = null;
}

export async function loadSalesData(): Promise<SalesRow[]> {
  const { sales } = await fetchApiData();
  return sales
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

export async function loadDataSyncedAt(): Promise<Date | null> {
  const { syncedAt } = await fetchApiData();
  return syncedAt ? new Date(syncedAt) : null;
}

export async function loadUangMasukData(): Promise<UangMasukRow[]> {
  const { uangMasuk } = await fetchApiData();
  return uangMasuk
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
  const { targets } = await fetchApiData();
  return targets
    .map((r): TargetRow => ({
      namaSalesman: String(r.nama_salesman ?? '').trim(),
      depo: String(r.depo ?? '').trim().toUpperCase(),
      supplier: String(r.supplier ?? '').trim().toUpperCase(),
      tahun: r.tahun ?? new Date().getFullYear(),
      monthly:
        Array.isArray(r.monthly) && r.monthly.length === 12
          ? r.monthly.map((v) => Number(v) || 0)
          : new Array(12).fill(0),
    }))
    .filter((r) => r.namaSalesman);
}
