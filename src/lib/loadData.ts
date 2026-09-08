import type { SalesRow, TargetRow, UangMasukRow } from './types';
import { deriveDateParts, normalizeBulanToMonthNum } from './types';

// ---------------------------------------------------------------------------
// MODE SUPABASE (lewat endpoint /api): dashboard TIDAK memanggil Supabase
// langsung dari browser. Sebagai gantinya:
//
//   1. GET /api/meta  -> { syncedAt }  (query super ringan, cache 60 detik)
//   2. GET /api/data?v=<syncedAt>  -> seluruh data (sales/targets/uangMasuk),
//      di-gzip oleh server, di-cache di CDN Vercel selama 4 jam per versi.
//
// Kenapa dua langkah? Supaya CDN Vercel bisa cache /api/data selama
// berjam-jam (murah, cepat), TAPI begitu Anda menjalankan
// `node --env-file=.env scripts/sync-data.mjs` dan syncedAt berubah,
// dashboard otomatis tahu ada versi baru (lewat /api/meta yang cache-nya
// cuma 60 detik) dan mengambil ulang /api/data dengan query string `v` yang
// baru -> cache lama otomatis dilewati, data terbaru langsung didapat.
//
// Lihat api/meta.js dan api/data.js untuk detail server-side-nya.
//
// PENTING untuk development lokal: route /api/* ini adalah Vercel Serverless
// Functions, TIDAK jalan dengan `npm run dev` (Vite) biasa. Untuk mengetesnya
// secara lokal, jalankan `vercel dev` (butuh `.env` berisi SUPABASE_URL &
// SUPABASE_ANON_KEY, dan login `vercel login` sekali). Kalau cuma `npm run
// dev`, fetch ke /api/meta & /api/data akan gagal (404) karena Vite tidak
// tahu cara menjalankan fungsi serverless ini.

interface ApiPayload {
  sales: RawSalesRow[];
  targets: RawTargetRow[];
  uangMasuk: RawUangMasukRow[];
  syncedAt: string | null;
}

interface RawSalesRow {
  no_faktur: string;
  nominal: number;
  supp: string;
  depo: string;
  tgl_faktur: string | null; // "yyyy-mm-dd"
  kd_grup: string;
  sales: string;
  kota: string;
  kecamatan: string;
  tele: string;
  kode_pelanggan: string;
  nama_pelanggan: string;
  alamat_pelanggan: string;
  nama_barang: string;
  qty: number;
  rank_bayar: string;
  rank_omset: string;
}

interface RawTargetRow {
  nama_salesman: string;
  depo: string;
  supplier: string;
  tahun: number;
  monthly: number[];
}

interface RawUangMasukRow {
  tahun: number;
  bulan: string;
  depo: string;
  target_piutang: number;
  realisasi_piutang: number;
}

// Cache di memori: seluruh payload cuma diambil SEKALI per sesi (sampai
// tombol Refresh menekan resetDataCache()), lalu dipakai bareng oleh
// loadSalesData/loadTargetData/loadUangMasukData/loadDataSyncedAt.
let payloadPromise: Promise<ApiPayload> | null = null;

async function fetchMeta(): Promise<string | null> {
  try {
    const res = await fetch('/api/meta', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { syncedAt: string | null };
    return json.syncedAt ?? null;
  } catch {
    return null;
  }
}

async function fetchPayload(): Promise<ApiPayload> {
  const syncedAt = await fetchMeta();
  const v = syncedAt ?? 'v0';
  // TIDAK pakai { cache: 'no-store' } di sini (beda dengan /api/meta di
  // atas) -- payload ini besar (~2,4MB gzip), jadi kita SENGAJA izinkan
  // browser pakai HTTP cache-nya sendiri (lihat header max-age yang diset
  // di api/data.js). Aman: URL-nya sudah menyertakan versi (`?v=`), jadi
  // begitu ada sync baru, otomatis jadi URL baru yang tidak match cache
  // lama manapun -- browser tidak akan pernah menyajikan data basi.
  const res = await fetch(`/api/data?v=${encodeURIComponent(v)}`);
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ? ` - ${body.error}` : '';
    } catch {
      /* respons bukan JSON, abaikan */
    }
    throw new Error(`Gagal memuat /api/data (status ${res.status})${detail}`);
  }
  return (await res.json()) as ApiPayload;
}

function getPayload(): Promise<ApiPayload> {
  if (!payloadPromise) {
    payloadPromise = fetchPayload().catch((err) => {
      payloadPromise = null;
      throw err;
    });
  }
  return payloadPromise;
}

/** Dipanggil oleh tombol Refresh supaya percobaan berikutnya mengambil ulang data dari /api. */
export function resetDataCache() {
  payloadPromise = null;
}

function parseIsoDate(v: string | null): Date | null {
  if (!v) return null;
  // "yyyy-mm-dd" -> Date lokal (hindari geser hari akibat timezone UTC).
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, yyyy, mm, dd] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
}

export async function loadSalesData(): Promise<SalesRow[]> {
  const { sales: raw } = await getPayload();
  return raw
    .map((row): SalesRow => {
      const tglFaktur = parseIsoDate(row.tgl_faktur);
      const { bulan, monthNum, tahun, tanggal, tanggalStr } = deriveDateParts(tglFaktur);
      return {
        noFaktur: row.no_faktur ?? '',
        nominal: row.nominal ?? 0,
        supp: row.supp ?? '',
        depo: (row.depo ?? '').toUpperCase(),
        tglFaktur,
        tanggalStr,
        tanggal,
        bulan,
        monthNum,
        tahun,
        kdGrup: row.kd_grup ?? '',
        sales: row.sales ?? '',
        kota: (row.kota ?? '').toUpperCase(),
        kecamatan: row.kecamatan ?? '',
        tele: row.tele ?? '',
        kodePelanggan: row.kode_pelanggan ?? '',
        namaPelanggan: row.nama_pelanggan ?? '',
        alamatPelanggan: row.alamat_pelanggan ?? '',
        namaBarang: row.nama_barang ?? '',
        qty: row.qty ?? 0,
        rankBayar: row.rank_bayar ?? '',
        rankOmset: row.rank_omset ?? '',
      };
    })
    .filter((r) => r.depo && r.sales);
}

export async function loadDataSyncedAt(): Promise<Date | null> {
  const { syncedAt } = await getPayload();
  if (!syncedAt) return null;
  const d = new Date(syncedAt);
  return isNaN(d.getTime()) ? null : d;
}

export async function loadUangMasukData(): Promise<UangMasukRow[]> {
  const { uangMasuk: raw } = await getPayload();
  return raw
    .map((row): UangMasukRow => {
      const bulanRaw = (row.bulan ?? '').trim();
      return {
        tahun: row.tahun ?? new Date().getFullYear(),
        bulan: bulanRaw,
        monthNum: normalizeBulanToMonthNum(bulanRaw),
        depo: (row.depo ?? '').toUpperCase(),
        targetPiutang: row.target_piutang ?? 0,
        realisasiPiutang: row.realisasi_piutang ?? 0,
      };
    })
    .filter((r) => r.depo);
}

export async function loadTargetData(): Promise<TargetRow[]> {
  const { targets: raw } = await getPayload();
  return raw
    .map((row): TargetRow => ({
      namaSalesman: row.nama_salesman ?? '',
      depo: (row.depo ?? '').toUpperCase(),
      supplier: (row.supplier ?? '').toUpperCase(),
      tahun: row.tahun ?? new Date().getFullYear(),
      monthly: Array.isArray(row.monthly) ? row.monthly.map((n) => n ?? 0) : new Array(12).fill(0),
    }))
    .filter((r) => r.namaSalesman);
}
