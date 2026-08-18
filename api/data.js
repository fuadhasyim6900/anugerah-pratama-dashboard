import { createClient } from '@supabase/supabase-js';
import zlib from 'node:zlib';

// Endpoint ini menggantikan pemanggilan Supabase LANGSUNG dari browser.
//
// Sebelumnya: setiap sales buka dashboard -> browser mereka sendiri yang
// menghubungi Supabase dan menyedot seluruh tabel `sales` (± 262.000 baris,
// ± 2,4 MB terkompresi). Tidak ada cache sama sekali karena ini SPA murni
// (tidak ada server Next.js seperti di app Update Stok AP).
//
// Sekarang: browser memanggil /api/data (endpoint ini). Endpoint ini yang
// menghubungi Supabase, DAN Vercel meng-cache hasilnya di CDN.
//
// CACHE "PER VERSI" (supaya sync langsung otomatis kelihatan, bukan nunggu
// jam cache habis): frontend (lihat src/lib/loadData.ts) selalu memanggil
// endpoint ini dengan query `?v=<synced_at>`, yang nilainya diambil lebih
// dulu dari /api/meta (endpoint kecil & murah, cache-nya cuma 60 detik).
// Karena URL `/api/data?v=...` beda tiap kali Anda sync, Vercel otomatis
// menganggapnya request BARU (cache MISS) begitu ada sync baru -- tidak
// perlu "purge cache" manual. Untuk versi (v) yang SAMA, boleh di-cache
// SANGAT lama karena isinya memang tidak akan berubah untuk versi itu.
//
// Jadi alurnya: sync selesai -> data_meta.synced_at berubah -> dalam waktu
// maksimal 60 detik (umur cache /api/meta) semua browser mendeteksi versi
// baru -> /api/data?v=<versi-baru> otomatis diambil ulang dari Supabase
// SEKALI (untuk versi itu), lalu dilayani dari cache untuk semua sales
// lain. Supabase tetap hanya diakses sekali per sync, bukan per kunjungan.

const PAGE_SIZE = 1000;

// Versi diketahui (v ada di query, dikirim frontend) -> aman di-cache lama,
// karena kontennya memang unik & tidak berubah per versi. 1 tahun (dalam
// praktiknya tidak akan sampai kepakai selama itu, versi baru akan selalu
// muncul begitu ada sync berikutnya).
const CACHE_SECONDS_VERSIONED = 31536000;

// Fallback kalau entah kenapa request datang TANPA parameter versi (mis.
// dipanggil manual, atau /api/meta gagal di frontend). Cache pendek saja
// supaya tidak nyangkut lama-lama di data basi.
const CACHE_SECONDS_FALLBACK = 300;

async function fetchAllRows(supabase, table, columns) {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(`Gagal menghitung baris "${table}": ${countError.message}`);
  const total = count ?? 0;
  if (total === 0) return [];

  const pageStarts = [];
  for (let from = 0; from < total; from += PAGE_SIZE) pageStarts.push(from);

  const pages = await Promise.all(
    pageStarts.map(async (from) => {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase.from(table).select(columns).range(from, to);
      if (error) throw new Error(`Gagal memuat "${table}": ${error.message}`);
      return data ?? [];
    })
  );

  return pages.flat();
}

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    res.status(500).json({
      error:
        'SUPABASE_URL dan/atau SUPABASE_ANON_KEY belum diset di Environment Variables Vercel (lihat README bagian deploy).',
    });
    return;
  }

  const supabase = createClient(url, key);

  try {
    const [sales, targets, uangMasuk, metaResult] = await Promise.all([
      fetchAllRows(supabase, 'sales', 'nominal, supp, depo, bulan, tahun, kd_grup, sales, kota, tele'),
      fetchAllRows(supabase, 'targets', 'nama_salesman, depo, supplier, tahun, monthly'),
      fetchAllRows(supabase, 'uang_masuk', 'tahun, bulan, depo, target_piutang, realisasi_piutang').catch(
        () => []
      ),
      supabase.from('data_meta').select('synced_at').eq('id', 1).maybeSingle(),
    ]);

    const payload = JSON.stringify({
      sales,
      targets,
      uangMasuk,
      syncedAt: metaResult.data?.synced_at ?? null,
    });

    // Kompres manual sebelum dikirim. Alasan: response mentah (JSON belum
    // dikompresi) ± 44 MB untuk ± 262.000 baris tabel `sales` -- ini
    // kemungkinan besar melebihi batas ukuran maksimal yang boleh disimpan
    // Vercel di CDN cache-nya, sehingga sebelumnya request SELALU muncul
    // MISS walau Cache-Control sudah benar (responsnya berhasil dibuat,
    // tapi ditolak untuk disimpan ke cache karena kebesaran).
    // Setelah di-gzip di sini, ukurannya turun jadi ± 2,4 MB -- jauh di
    // bawah batas, sehingga bisa benar-benar tersimpan di cache. Browser
    // otomatis men-decompress ini sendiri (lewat header Content-Encoding),
    // tidak perlu perubahan apa pun di kode frontend.
    const compressed = zlib.gzipSync(payload);

    // Ada parameter versi (?v=...) di URL -> aman di-cache sangat lama,
    // karena versi baru = URL baru = otomatis cache MISS begitu ada sync.
    // Tidak ada versi -> fallback pendek (lihat komentar CACHE_SECONDS_FALLBACK).
    const hasVersion = typeof req.query.v === 'string' && req.query.v.length > 0;
    const cacheSeconds = hasVersion ? CACHE_SECONDS_VERSIONED : CACHE_SECONDS_FALLBACK;

    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheSeconds}, stale-while-revalidate=3600`
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.status(200).send(compressed);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Gagal memuat data' });
  }
}