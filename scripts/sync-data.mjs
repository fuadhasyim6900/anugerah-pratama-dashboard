// Script untuk update data Supabase dari file Excel.
// Jalankan setiap kali DATA.xlsx / DATA_TARGET_FUAD.xlsx sudah diupdate:
//
//   node scripts/sync-data.mjs
//
// Script ini akan MENGHAPUS SEMUA baris lama di tabel `sales` & `targets`,
// lalu memasukkan ulang seluruh data dari kedua file Excel. Ini otomatis
// menangani baris yang berubah maupun baris baru sekaligus.
//
// PENTING: script ini butuh SUPABASE_SECRET_KEY (bukan anon/publishable key),
// karena RLS hanya mengizinkan anon untuk membaca, bukan menulis. Secret key
// TIDAK BOLEH dipakai di kode frontend/browser — script ini hanya jalan di
// komputer Anda (Node.js), jadi aman.

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Env variables dimuat lewat flag `node --env-file=.env` saat menjalankan
// script ini (lihat perintah di README) — tidak perlu package tambahan.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    'ERROR: pastikan SUPABASE_URL dan SUPABASE_SECRET_KEY ada di file .env\n' +
      '(SUPABASE_SECRET_KEY diambil dari Supabase -> Settings -> API Keys -> Secret keys)'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY);

const SALES_XLSX = path.join(ROOT, 'public/data/DATA.xlsx');
const TARGET_XLSX = path.join(ROOT, 'public/data/DATA_TARGET_FUAD.xlsx');
const UANG_MASUK_XLSX = path.join(ROOT, 'public/data/REALISASI UANG MASUK.xlsx');
const BATCH_SIZE = 500;

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalizeKey(k) {
  return k.replace(/^["'\s]+|["'\s]+$/g, '').trim().toUpperCase();
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[normalizeKey(k)] = v;
  return out;
}

function readSheet(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: file tidak ditemukan: ${filePath}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

async function deleteAll(table) {
  console.log(`Menghapus data lama di tabel "${table}"...`);
  const { error } = await supabase.from(table).delete().gte('id', 0);
  if (error) throw new Error(`Gagal menghapus data lama di "${table}": ${error.message}`);
}

async function insertBatched(table, rows) {
  console.log(`Memasukkan ${rows.length} baris ke tabel "${table}"...`);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`Gagal insert batch ke-${i / BATCH_SIZE + 1} di "${table}": ${error.message}`);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  console.log('\n  selesai.');
}

// TGL FAKTUR bisa berupa objek Date (kalau cellDates:true berhasil
// mendeteksi format tanggal sel), serial Excel, atau string "dd/mm/yyyy".
//
// PENTING soal timezone & presisi: saat SheetJS membaca sel bertipe Date
// dengan cellDates:true, objek Date yang dihasilkan sudah punya tanggal yang
// benar secara LOKAL (mis. tengah malam WIB tanggal 20) -- jadi kita harus
// pakai getFullYear/getMonth/getDate (versi lokal), BUKAN toISOString()
// (versi UTC), supaya tanggal tidak geser gara-gara timezone.
//
// TAPI: serial tanggal Excel disimpan sebagai angka desimal (floating
// point), dan itu kadang tidak benar-benar bulat -- misalnya alih-alih
// persis 00:00:00 tengah malam, hasilnya jadi 23:59:56 (meleset beberapa
// detik). Kalau tidak diantisipasi, "23:59:56 tanggal 19" itu terbaca
// sebagai tanggal 19, padahal maksudnya tanggal 20. Makanya sebelum
// membaca tahun/bulan/tanggalnya, waktunya dibulatkan ke MENIT terdekat
// dulu -- itu cukup untuk menghilangkan noise beberapa detik ini tanpa
// mengubah tanggal untuk kasus normal.
function toIsoDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const rounded = new Date(Math.round(v.getTime() / 60000) * 60000);
    const yyyy = rounded.getFullYear();
    const mm = String(rounded.getMonth() + 1).padStart(2, '0');
    const dd = String(rounded.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string' && v.trim()) {
    const m = v.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      const [, dd, mm, yyRaw] = m;
      const yyyy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
      const d = new Date(Date.UTC(yyyy, Number(mm) - 1, Number(dd)));
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

// CATATAN MIGRASI SUPABASE: sejak data sumber ganti dari kolom BULAN/TAHUN
// terpisah menjadi TGL FAKTUR (+ kolom detail per transaksi seperti Qty,
// Nama Barang, data pelanggan), tabel `sales` di Supabase juga perlu kolom
// baru: tgl_faktur (date), qty (numeric), kode_pelanggan, nama_pelanggan,
// alamat_pelanggan, nama_barang, kecamatan, rank_bayar, rank_omset (text).
// bulan/tahun tetap disimpan (diturunkan dari tgl_faktur) supaya query lama
// tetap jalan. Jalankan ALTER TABLE yang sesuai di Supabase sebelum sync.
async function syncSales() {
  const raw = readSheet(SALES_XLSX);
  const rows = raw
    .map((r) => {
      const row = normalizeRow(r);
      const iso = toIsoDate(row['TGL FAKTUR']);
      const d = iso ? new Date(iso) : null;
      return {
        no_faktur: String(row['NO FAKTUR'] ?? '').trim(),
        nominal: toNumber(row['NOMINAL']),
        supp: String(row['SUPP'] ?? '').trim(),
        depo: String(row['DEPO'] ?? '').trim().toUpperCase(),
        tgl_faktur: iso,
        bulan: d ? String(d.getUTCMonth() + 1) : '',
        tahun: d ? d.getUTCFullYear() : 2026,
        kd_grup: String(row['KD GRUP'] ?? '').trim(),
        sales: String(row['SALES'] ?? '').trim(),
        kota: String(row['KOTA'] ?? '').trim().toUpperCase(),
        kecamatan: String(row['KECAMATAN'] ?? '').trim(),
        tele: String(row['TELE'] ?? '').trim(),
        kode_pelanggan: String(row['KODE PELANGGAN'] ?? '').trim(),
        nama_pelanggan: String(row['NAMA PELANGGAN'] ?? '').trim(),
        alamat_pelanggan: String(row['ALAMAT PELANGGAN'] ?? '').trim(),
        nama_barang: String(row['NAMA BARANG'] ?? '').trim(),
        qty: toNumber(row['QTY']),
        rank_bayar: String(row['RANK BAYAR'] ?? '').trim(),
        rank_omset: String(row['RANK OMSET'] ?? '').trim(),
      };
    })
    .filter((r) => r.depo && r.sales);

  await deleteAll('sales');
  await insertBatched('sales', rows);
}

async function syncTargets() {
  const raw = readSheet(TARGET_XLSX);
  const monthCols = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const rows = raw
    .map((r) => {
      const row = normalizeRow(r);
      return {
        nama_salesman: String(row['NAMA SALESMAN'] ?? '').trim(),
        depo: String(row['DEPO'] ?? '').trim().toUpperCase(),
        supplier: String(row['SUPPLIER'] ?? '').trim().toUpperCase(),
        tahun: row['TAHUN'] ? Number(row['TAHUN']) : new Date().getFullYear(),
        monthly: monthCols.map((c) => toNumber(row[c])),
      };
    })
    .filter((r) => r.nama_salesman);

  await deleteAll('targets');
  await insertBatched('targets', rows);
}

async function syncUangMasuk() {
  // Tabel `uang_masuk` bersifat opsional — kalau file sumbernya belum ada
  // (atau tabelnya belum dibuat di Supabase, lihat README), lewati saja
  // tanpa menggagalkan sinkronisasi sales/targets.
  if (!fs.existsSync(UANG_MASUK_XLSX)) {
    console.log(`Melewati "uang_masuk": file tidak ditemukan (${UANG_MASUK_XLSX}).`);
    return;
  }
  const raw = readSheet(UANG_MASUK_XLSX);
  const rows = raw
    .map((r) => {
      const row = normalizeRow(r);
      return {
        tahun: row['TAHUN'] ? Number(row['TAHUN']) : new Date().getFullYear(),
        bulan: String(row['BULAN'] ?? '').trim(),
        depo: String(row['DEPO'] ?? '').trim().toUpperCase(),
        target_piutang: toNumber(row['TARGET PIUTANG']),
        realisasi_piutang: toNumber(row['REALISASI PIUTANG']),
      };
    })
    .filter((r) => r.depo);

  try {
    await deleteAll('uang_masuk');
    await insertBatched('uang_masuk', rows);
  } catch (err) {
    console.error(
      `\nGAGAL sinkronisasi "uang_masuk": ${err.message}\n` +
        'Pastikan tabel "uang_masuk" sudah dibuat di Supabase (lihat README, bagian "Realisasi Uang Masuk").\n' +
        'Melanjutkan tanpa menyinkronkan data ini...'
    );
  }
}

async function updateSyncedAt() {
  console.log('Mencatat waktu update data...');
  const { error } = await supabase
    .from('data_meta')
    .upsert({ id: 1, synced_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(`Gagal mencatat waktu update di "data_meta": ${error.message}`);
}

async function main() {
  console.log('=== Sinkronisasi data Excel -> Supabase ===\n');
  await syncSales();
  await syncTargets();
  await syncUangMasuk();
  await updateSyncedAt();
  console.log('\nSelesai! Buka dashboard Anda dan refresh untuk lihat data terbaru.');
}

main().catch((err) => {
  console.error('\nGAGAL:', err.message);
  // Pakai exitCode (bukan process.exit paksa) supaya Node.js sempat menutup
  // koneksi jaringan ke Supabase dengan bersih sebelum proses berakhir.
  // process.exit() langsung di sini bisa memicu crash kosmetik di Windows
  // ("Assertion failed ... UV_HANDLE_CLOSING") karena koneksi masih ditutup.
  process.exitCode = 1;
});
