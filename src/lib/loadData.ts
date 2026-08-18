import type { SalesRow, TargetRow, UangMasukRow } from './types';
import { normalizeBulanToMonthNum } from './types';

// Data sekarang diambil lewat /api/data (Vercel Serverless Function), BUKAN
// langsung dari Supabase di browser. Alasannya soal kuota: tabel `sales`
// berisi ± 262.000 baris — kalau tiap browser sales menariknya langsung dari
// Supabase setiap kali buka halaman, kuota egress Supabase Free (5 GB/bulan)
// akan terlampaui hanya dengan traffic ringan sekalipun.
//
// CACHE "PER VERSI": sebelum mengambil data besar, kita tanya dulu ke
// /api/meta (endpoint kecil, cache CDN cuma 60 detik) berapa `syncedAt`
// (versi data) saat ini. Lalu /api/data dipanggil dengan `?v=<syncedAt>` —
// URL itu di-cache Vercel SANGAT lama karena isinya memang tidak berubah
// untuk versi yang sama. Begitu Anda jalankan `node scripts/sync-data.mjs`,
// `syncedAt` berubah, dan dalam ≤60 detik SEMUA browser otomatis mendeteksi
// versi baru lalu mengambil data segar — tanpa perlu klik Refresh, dan
// tanpa Supabase dipukul oleh tiap kunjungan sales (lihat api/data.js &
// api/meta.js untuk detailnya).

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

// Satu "sesi" fetch (meta + data) dipakai bersama oleh semua fungsi load*()
// di bawah (di-dedupe lewat Promise ini), jadi walau useSalesData.tsx
// memanggil 4 fungsi sekaligus lewat Promise.all, browser cuma benar-benar
// melakukan fetch jaringan sekali per pemuatan halaman.
let inFlight: Promise<ApiResponse> | null = null;

async function fetchApiData(): Promise<ApiResponse> {
  if (!inFlight) {
    inFlight = (async () => {
      // 1) Tanya versi data terbaru dulu (murah, cache 60 detik). Kalau
      // gagal (mis. tabel data_meta belum dibuat), tetap lanjut pakai
      // versi fallback 'v0' supaya dashboard tidak macet.
      let version = 'v0';
      try {
        const metaRes = await fetch('/api/meta');
        const meta = (await metaRes.json()) as { syncedAt: string | null };
        version = meta.syncedAt ?? 'v0';
      } catch {
        // biarkan version = 'v0'
      }

      // 2) Ambil data besar untuk versi tsb -- URL unik per versi, jadi
      // otomatis fresh begitu ada sync baru, tanpa perlu purge cache manual.
      const res = await fetch(`/api/data?v=${encodeURIComponent(version)}`);
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(json.error || `Gagal memuat data (status ${res.status})`);
      return json;
    })().catch((err) => {
      inFlight = null; // supaya klik "Refresh" berikutnya mencoba lagi, bukan terus gagal
      throw err;
    });
  }
  return inFlight;
}

/** Dipanggil oleh tombol Refresh supaya percobaan berikutnya menjalankan
 * ulang alur meta -> data dari awal. Karena /api/meta cache-nya cuma 60
 * detik, dalam praktiknya Refresh akan selalu (atau hampir selalu)
 * mendapat versi data terkini -- tidak perlu menunggu jam-jaman lagi. */
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
