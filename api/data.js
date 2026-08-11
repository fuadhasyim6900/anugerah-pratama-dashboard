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
// menghubungi Supabase, DAN Vercel meng-cache hasilnya di CDN selama
// CACHE_SECONDS di bawah. Selama jendela cache itu, Supabase hanya diakses
// SEKALI walau ada ratusan kunjungan dari puluhan sales berbeda.

const PAGE_SIZE = 1000;

// Cache 4 jam. Sesuaikan kalau jadwal update data harian Anda beda -
// misal kalau cuma sync 1x/hari, angka ini bisa dinaikkan (mis. 21600 = 6 jam
// atau 43200 = 12 jam) supaya makin jarang Supabase diakses.
const CACHE_SECONDS = 14400;

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

    // s-maxage: berapa lama Vercel CDN boleh menyajikan hasil ini dari cache
    // tanpa menghubungi Supabase lagi.
    // stale-while-revalidate: kalau ada request PAS SAAT cache baru basi,
    // tetap sajikan versi lama itu ke sales tsb (biar tidak menunggu),
    // sambil Vercel mengambil data segar di belakang layar untuk request
    // berikutnya.
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.status(200).send(compressed);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Gagal memuat data' });
  }
}