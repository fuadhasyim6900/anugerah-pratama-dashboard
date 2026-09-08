import { createClient } from '@supabase/supabase-js';

// Endpoint KECIL & MURAH -- cuma mengembalikan { syncedAt }, bukan seluruh
// data penjualan. Tujuannya: frontend memanggil ini dulu (lihat
// src/lib/loadData.ts) untuk tahu "versi data terbaru saat ini", SEBELUM
// mengambil data besar dari /api/data?v=<versi>.
//
// Cache-nya sengaja PENDEK (60 detik) -- karena responsnya kecil, memanggil
// Supabase tiap ~60 detik untuk query super ringan ini (1 baris, 1 kolom)
// tidak berarti buat kuota egress. Ini yang membuat dashboard "otomatis"
// mendeteksi sync baru dalam hitungan detik, bukan berjam-jam, TANPA perlu
// menurunkan cache endpoint /api/data yang besar itu.
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    res.status(500).json({
      error:
        'SUPABASE_URL dan/atau SUPABASE_ANON_KEY belum diset di Environment Variables Vercel.',
    });
    return;
  }

  const supabase = createClient(url, key);

  try {
    const { data, error } = await supabase
      .from('data_meta')
      .select('synced_at')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ syncedAt: data?.synced_at ?? null });
  } catch (e) {
    // Kalau tabel data_meta belum dibuat (lihat README) atau error lain,
    // jangan sampai dashboard mogok -- kembalikan syncedAt: null, nanti
    // /api/data akan pakai versi fallback ('v0').
    res.status(200).json({ syncedAt: null });
  }
}
