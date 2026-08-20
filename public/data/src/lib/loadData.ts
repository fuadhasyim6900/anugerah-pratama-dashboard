import * as XLSX from 'xlsx';
import type { SalesRow, TargetRow, UangMasukRow } from './types';
import { deriveDateParts, normalizeBulanToMonthNum } from './types';

// ---------------------------------------------------------------------------
// MODE LOKAL: file Excel dibaca & di-parse LANGSUNG di browser (via SheetJS),
// dari folder public/data/ — persis seperti versi awal proyek ini sebelum
// dipindah ke Supabase. Ini dipakai dulu supaya bisa langsung dijalankan
// `npm run dev` tanpa perlu setup Supabase/Vercel.
//
// Ketika nanti dipindah ke Supabase: cukup update `scripts/sync-data.mjs` &
// `api/data.js` (sudah disiapkan mengikuti kolom baru TGL FAKTUR di file
// ini juga) lalu ganti isi loadSalesData/loadTargetData/loadUangMasukData di
// bawah supaya fetch ke /api/data seperti versi sebelumnya. Bentuk
// SalesRow/TargetRow/UangMasukRow yang dikembalikan sengaja dibuat sama
// persis supaya halaman-halaman lain tidak perlu diubah sama sekali.

const SALES_URL = '/data/DATA.xlsx';
const TARGET_URL = '/data/DATA_TARGET_FUAD.xlsx';
const UANG_MASUK_URL = '/data/REALISASI UANG MASUK.xlsx';

function normalizeKey(k: string): string {
  return k.replace(/^["'\s]+|["'\s]+$/g, '').trim().toUpperCase();
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[normalizeKey(k)] = v;
  return out;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// Excel bisa menyimpan tanggal sebagai: objek Date (kalau file dibaca dengan
// cellDates:true dan sel diformat sebagai tanggal), angka serial Excel, atau
// string ("04/01/2021", "2021-01-04", dst). Tangani ketiganya.
function toDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // Serial date Excel: hari sejak 1899-12-30.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    // Coba format "dd/mm/yyyy" atau "dd-mm-yyyy" dulu (umum di export lokal).
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      const [, dd, mm, yyRaw] = m;
      const yyyy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
      const d = new Date(yyyy, Number(mm) - 1, Number(dd));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

interface FetchedWorkbook {
  rows: Record<string, unknown>[];
  lastModified: Date | null;
}

const fileCache = new Map<string, Promise<FetchedWorkbook>>();

async function fetchSheet(url: string): Promise<FetchedWorkbook> {
  if (!fileCache.has(url)) {
    const promise = (async (): Promise<FetchedWorkbook> => {
      // cache: 'no-store' + query cache-buster supaya selalu ambil file
      // terbaru dari disk, bukan versi lama yang ter-cache browser.
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Gagal memuat ${url} (status ${res.status})`);
      const lastModifiedHeader = res.headers.get('last-modified');
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      return { rows, lastModified: lastModifiedHeader ? new Date(lastModifiedHeader) : null };
    })().catch((err) => {
      fileCache.delete(url);
      throw err;
    });
    fileCache.set(url, promise);
  }
  return fileCache.get(url)!;
}

/** Dipanggil oleh tombol Refresh supaya percobaan berikutnya mengambil ulang file dari disk. */
export function resetDataCache() {
  fileCache.clear();
}

export async function loadSalesData(): Promise<SalesRow[]> {
  const { rows: raw } = await fetchSheet(SALES_URL);
  return raw
    .map((r): SalesRow => {
      const row = normalizeRow(r);
      const tglFaktur = toDate(row['TGL FAKTUR']);
      const { bulan, monthNum, tahun, tanggal, tanggalStr } = deriveDateParts(tglFaktur);
      return {
        nominal: toNumber(row['NOMINAL']),
        supp: String(row['SUPP'] ?? '').trim(),
        depo: String(row['DEPO'] ?? '').trim().toUpperCase(),
        tglFaktur,
        tanggalStr,
        tanggal,
        bulan,
        monthNum,
        tahun,
        kdGrup: String(row['KD GRUP'] ?? '').trim(),
        sales: String(row['SALES'] ?? '').trim(),
        kota: String(row['KOTA'] ?? '').trim().toUpperCase(),
        kecamatan: String(row['KECAMATAN'] ?? '').trim(),
        tele: String(row['TELE'] ?? '').trim(),
        kodePelanggan: String(row['KODE PELANGGAN'] ?? '').trim(),
        namaPelanggan: String(row['NAMA PELANGGAN'] ?? '').trim(),
        alamatPelanggan: String(row['ALAMAT PELANGGAN'] ?? '').trim(),
        namaBarang: String(row['NAMA BARANG'] ?? '').trim(),
        qty: toNumber(row['QTY']),
        rankBayar: String(row['RANK BAYAR'] ?? '').trim(),
        rankOmset: String(row['RANK OMSET'] ?? '').trim(),
      };
    })
    .filter((r) => r.depo && r.sales);
}

export async function loadDataSyncedAt(): Promise<Date | null> {
  const { lastModified } = await fetchSheet(SALES_URL);
  return lastModified;
}

export async function loadUangMasukData(): Promise<UangMasukRow[]> {
  const { rows: raw } = await fetchSheet(UANG_MASUK_URL);
  return raw
    .map((r): UangMasukRow => {
      const row = normalizeRow(r);
      const bulanRaw = String(row['BULAN'] ?? '').trim();
      return {
        tahun: row['TAHUN'] ? Number(row['TAHUN']) : new Date().getFullYear(),
        bulan: bulanRaw,
        monthNum: normalizeBulanToMonthNum(bulanRaw),
        depo: String(row['DEPO'] ?? '').trim().toUpperCase(),
        targetPiutang: toNumber(row['TARGET PIUTANG']),
        realisasiPiutang: toNumber(row['REALISASI PIUTANG']),
      };
    })
    .filter((r) => r.depo);
}

export async function loadTargetData(): Promise<TargetRow[]> {
  const { rows: raw } = await fetchSheet(TARGET_URL);
  const monthCols = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return raw
    .map((r): TargetRow => {
      const row = normalizeRow(r);
      return {
        namaSalesman: String(row['NAMA SALESMAN'] ?? '').trim(),
        depo: String(row['DEPO'] ?? '').trim().toUpperCase(),
        supplier: String(row['SUPPLIER'] ?? '').trim().toUpperCase(),
        tahun: row['TAHUN'] ? Number(row['TAHUN']) : new Date().getFullYear(),
        monthly: monthCols.map((c) => toNumber(row[c])),
      };
    })
    .filter((r) => r.namaSalesman);
}
