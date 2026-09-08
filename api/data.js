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

  // Ambil batas id (index-only, sangat cepat, tidak peduli seberapa besar
  // atau "bolong" tabelnya) untuk membagi pekerjaan jadi beberapa JALUR
  // paralel. Kita TIDAK menebak ukuran langkah id dari satu halaman contoh
  // (percobaan sebelumnya salah: kalau tabel sudah pernah di-sync ulang,
  // id tidak mulai dari 1, jadi tebakan langkahnya meleset jauh dan banyak
  // baris terlewat tanpa error apapun).
  const { data: minRow, error: minError } = await supabase
    .from(table)
    .select('id')
    .order('id', { ascending: true })
    .limit(1);
  if (minError) throw new Error(`Gagal membaca id minimum "${table}": ${minError.message}`);
  const { data: maxRow, error: maxError } = await supabase
    .from(table)
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  if (maxError) throw new Error(`Gagal membaca id maksimum "${table}": ${maxError.message}`);
  const minId = minRow?.[0]?.id;
  const maxId = maxRow?.[0]?.id;
  if (minId == null || maxId == null) return [];

  // Bagi rentang [minId, maxId] jadi CONCURRENCY potongan yang kira-kira
  // sama besar. Tiap jalur menyisir potongannya SENDIRI secara berurutan
  // memakai keyset/cursor (WHERE id >= cursor AND id <= akhir ORDER BY id
  // LIMIT n), lalu memajukan cursor ke id TERAKHIR YANG BENAR-BENAR
  // DIDAPAT + 1 setiap putaran, sampai potongan itu habis. Ini otomatis
  // benar berapa pun ukuran halaman yang sebenarnya dikembalikan Supabase
  // (termasuk kalau dipotong ke "Max Rows"-nya) dan berapa pun besar
  // "lompatan" id di tabel (misalnya bekas sync-sync sebelumnya) --
  // TIDAK ADA tebakan ukuran langkah yang bisa meleset seperti sebelumnya.
  //
  // `id` perlu ikut diminta ke Supabase supaya kita tahu harus lanjut dari
  // mana, walau caller (`columns`) tidak selalu memintanya -- makanya
  // 'id' dilepas lagi dari tiap baris sebelum dikembalikan, supaya bentuk
  // datanya persis seperti yang diminta caller.
  const columnsWithId = `id,${columns}`;
  const span = maxId - minId + 1;
  const rangeSize = Math.max(Math.ceil(span / CONCURRENCY), 1);
  const ranges = [];
  for (let start = minId; start <= maxId; start += rangeSize) {
    ranges.push({ start, end: Math.min(start + rangeSize - 1, maxId) });
  }

  const results = await Promise.all(
    ranges.map(async ({ start, end }) => {
      const rows = [];
      let cursor = start;
      while (cursor <= end) {
        const { data, error } = await supabase
          .from(table)
          .select(columnsWithId)
          .gte('id', cursor)
          .lte('id', end)
          .order('id', { ascending: true })
          .limit(PAGE_SIZE);
        if (error) throw new Error(`Gagal memuat "${table}" (id ${cursor}-${end}): ${error.message}`);
        const page = data ?? [];
        if (page.length === 0) break;
        for (const row of page) {
          const { id, ...rest } = row;
          rows.push(rest);
        }
        const lastId = page[page.length - 1].id;
        if (lastId == null) break;
        // PENTING: jangan berhenti hanya karena baris yang kembali lebih
        // sedikit dari PAGE_SIZE yang diminta -- itu BUKAN tanda sudah
        // habis, karena Supabase bisa memotong hasil ke "Max Rows"-nya
        // sendiri (bisa jauh lebih kecil dari PAGE_SIZE) tanpa memberi
        // tahu. Satu-satunya tanda potongan ini benar-benar habis adalah
        // saat sebuah query mengembalikan 0 baris. Jadi selalu lanjutkan
        // dari id terakhir + 1 sampai itu terjadi (atau cursor lewat
        // batas akhir potongan).
        cursor = lastId + 1;
      }
      return rows;
    })
  );

  const all = results.flat();

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

    // max-age: berapa lama BROWSER pengunjung sendiri boleh pakai
    // salinannya sendiri dari disk cache, TANPA menyentuh jaringan sama
    // sekali (bukan cuma tidak menghubungi Supabase -- bahkan tidak
    // menghubungi Vercel). Ini yang sebelumnya hilang: cuma s-maxage yang
    // diset, dan s-maxage HANYA dipatuhi shared cache (CDN) seperti
    // Vercel, BUKAN oleh browser. Tanpa max-age, browser selalu mengunduh
    // ulang seluruh payload (~2,4MB gzip / ~44MB setelah didekompres)
    // setiap kali halaman di-reload, walau CDN Vercel-nya sendiri sudah
    // HIT -- itulah yang bikin reload tetap terasa lama.
    // Aman dipakai karena URL-nya sudah ber-versi lewat query string `v`
    // (lihat src/lib/loadData.ts): begitu ada sync baru, `v` berubah,
    // otomatis jadi URL baru yang tidak match cache lama manapun.
    // s-maxage: berapa lama Vercel CDN boleh menyajikan hasil ini dari cache
    // tanpa menghubungi Supabase lagi.
    // stale-while-revalidate: kalau ada request PAS SAAT cache baru basi,
    // tetap sajikan versi lama itu ke sales tsb (biar tidak menunggu),
    // sambil Vercel mengambil data segar di belakang layar untuk request
    // berikutnya.
    res.setHeader(
      'Cache-Control',
      `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.status(200).send(compressed);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Gagal memuat data' });
  }
}