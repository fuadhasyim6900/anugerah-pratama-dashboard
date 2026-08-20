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

// Ukuran per-halaman saat mengambil data dari Supabase. HARUS <= "Max Rows"
// yang di-set di Supabase Dashboard -> Project Settings -> API (defaultnya
// 1000 di Supabase, kalau belum dinaikkan di sana, angka di bawah ini akan
// tetap dipotong jadi 1000 oleh Supabase walau ditulis lebih besar di sini).
// Page lebih besar = lebih sedikit request paralel ke Supabase saat cache
// MISS = lebih cepat. Contoh: 262.000 baris / 1000 = ±262 request paralel
// (lambat) vs / 10000 = ±27 request paralel (jauh lebih cepat).
// Ukuran per-halaman yang DIMINTA dari Supabase. Ini cuma "permintaan" --
// kalau Supabase Dashboard -> Project Settings -> API -> "Max Rows" di-set
// lebih kecil dari angka ini (default Supabase: 1000), Supabase akan tetap
// memotong hasilnya ke angka Max Rows itu, BUKAN error. Makanya di bawah,
// setiap halaman berikutnya dimulai dari JUMLAH BARIS YANG BENAR-BENAR
// KEMBALI (rows.length), bukan dari PAGE_SIZE ini -- supaya tetap benar
// (tidak ada baris yang terlewat) berapa pun "Max Rows" di Supabase.
// Menaikkan "Max Rows" di Supabase tetap bermanfaat untuk KECEPATAN (lebih
// sedikit request bolak-balik), tapi sekarang bukan syarat KEBENARAN data.
const PAGE_SIZE = 10000;

// Cache 60 detik. Artinya: paling lama 1 menit setelah Anda menjalankan
// `node --env-file=.env scripts/sync-data.mjs`, semua sales yang buka
// dashboard otomatis melihat data terbaru (tanpa perlu redeploy Vercel).
// Trade-off: Supabase bisa diakses lebih sering dibanding sebelumnya
// (maksimal 1x per 60 detik per wilayah Vercel CDN, bukan per pengunjung -
// tetap jauh lebih hemat daripada tanpa cache sama sekali). Kalau nanti
// kuota Supabase jadi masalah, angka ini bisa dinaikkan lagi.
const CACHE_SECONDS = 60;

// Berapa banyak request boleh berjalan BERSAMAAN ke Supabase. Sebelumnya
// SEMUA halaman ditembak paralel sekaligus (bisa ±27 request untuk tabel
// `sales`) -- ini membanjiri compute Supabase (apalagi di project kecil),
// bikin query lain ikut melambat dan lebih mudah kena statement timeout.
// Membatasi ke beberapa saja tetap jauh lebih cepat daripada satu-satu,
// tanpa membebani database sampai timeout.
const CONCURRENCY = 4;

async function fetchAllRows(supabase, table, columns) {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(`Gagal menghitung baris "${table}": ${countError.message}`);
  const total = count ?? 0;
  if (total === 0) return [];

  // Langkah 1: "tes" dulu satu halaman untuk tahu ukuran SEBENARNYA yang
  // dikembalikan Supabase (bisa jadi dipotong ke "Max Rows" Supabase,
  // berapa pun PAGE_SIZE yang kita minta di sini). Diurutkan naik
  // berdasarkan `id` (primary key, sudah ber-index) supaya halaman
  // berikutnya bisa dilanjutkan dari id terakhir -- BUKAN dari OFFSET.
  //
  // Kenapa ganti dari OFFSET (.range()) ke keyset (id) pagination:
  // OFFSET di Postgres itu mahal untuk tabel besar -- untuk sampai ke
  // OFFSET 250.000, Postgres tetap harus memindai & membuang 250.000 baris
  // sebelumnya lebih dulu. Untuk tabel `sales` (±262.000 baris, ±27
  // halaman) ini bikin halaman-halaman belakang jadi berat, dan kalau
  // ditembak paralel sekaligus -> gampang kena "statement timeout".
  // Filter berdasar `id` (WHERE id > x ORDER BY id LIMIT n) memakai index
  // seek, jadi SAMA CEPATNYA di halaman manapun, tidak peduli posisinya.
  const { data: firstPage, error: firstError } = await supabase
    .from(table)
    .select(columns)
    .order('id', { ascending: true })
    .limit(PAGE_SIZE);
  if (firstError) throw new Error(`Gagal memuat "${table}": ${firstError.message}`);
  const first = firstPage ?? [];
  const actualPageSize = first.length;

  const all = [...first];

  if (actualPageSize > 0 && all.length < total) {
    // Perlu tahu id kolom dari halaman pertama untuk menghitung rentang id
    // per potongan berikutnya. `columns` yang diminta caller belum tentu
    // menyertakan `id`, jadi kita ambil batas id lewat query terpisah yang
    // ringan (hanya kolom id, index-only, sangat cepat).
    const { data: lastIdRow, error: lastIdError } = await supabase
      .from(table)
      .select('id')
      .order('id', { ascending: true })
      .range(actualPageSize - 1, actualPageSize - 1);
    if (lastIdError) throw new Error(`Gagal membaca id "${table}": ${lastIdError.message}`);
    const lastIdOfFirstPage = lastIdRow?.[0]?.id;

    const { data: maxIdRow, error: maxIdError } = await supabase
      .from(table)
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    if (maxIdError) throw new Error(`Gagal membaca id maksimum "${table}": ${maxIdError.message}`);
    const maxId = maxIdRow?.[0]?.id;

    if (lastIdOfFirstPage != null && maxId != null && lastIdOfFirstPage < maxId) {
      // Rentang id yang dicakup oleh halaman pertama (dipakai sebagai
      // ukuran "langkah" id untuk potongan-potongan berikutnya, supaya
      // masing-masing potongan diperkirakan berukuran actualPageSize
      // baris juga -- konsisten dengan batas Max Rows Supabase).
      const idStep = Math.max(lastIdOfFirstPage, 1);

      const chunkStarts = [];
      for (let from = lastIdOfFirstPage + 1; from <= maxId; from += idStep) {
        chunkStarts.push(from);
      }

      // Langkah 2: jalankan potongan-potongan sisanya dengan concurrency
      // terbatas (worker pool), bukan semua sekaligus.
      const results = new Array(chunkStarts.length);
      let nextIndex = 0;
      async function worker() {
        for (;;) {
          const i = nextIndex++;
          if (i >= chunkStarts.length) return;
          const from = chunkStarts[i];
          const to = from + idStep - 1;
          const { data, error } = await supabase
            .from(table)
            .select(columns)
            .gte('id', from)
            .lte('id', to)
            .order('id', { ascending: true });
          if (error) throw new Error(`Gagal memuat "${table}" (id ${from}-${to}): ${error.message}`);
          results[i] = data ?? [];
        }
      }
      const workerCount = Math.min(CONCURRENCY, chunkStarts.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
      for (const page of results) all.push(...page);
    }
  }

  // Jaring pengaman: kalau jumlah akhir tidak cocok dengan jumlah asli,
  // LEBIH BAIK GAGAL KERAS (error 500) DARIPADA diam-diam menampilkan data
  // yang kurang ke sales -- ini yang sebelumnya terjadi tanpa terlihat.
  if (all.length !== total) {
    throw new Error(
      `Data "${table}" tidak lengkap: diharapkan ${total} baris, hanya dapat ${all.length}. ` +
        'Coba lagi; kalau terus terjadi, cek koneksi/limit Supabase.'
    );
  }

  return all;
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
      // CATATAN MIGRASI: kolom baru (tgl_faktur, qty, nama_barang, data
      // pelanggan, dst) ditambahkan mengikuti struktur DATA.xlsx terbaru
      // (lihat scripts/sync-data.mjs). Tambahkan kolom-kolom ini ke tabel
      // `sales` di Supabase sebelum mengaktifkan endpoint ini lagi.
      fetchAllRows(supabase, 'sales',
        'no_faktur, nominal, supp, depo, tgl_faktur, bulan, tahun, kd_grup, sales, kota, kecamatan, tele, ' +
        'kode_pelanggan, nama_pelanggan, alamat_pelanggan, nama_barang, qty, rank_bayar, rank_omset'),
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
      `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.status(200).send(compressed);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Gagal memuat data' });
  }
}