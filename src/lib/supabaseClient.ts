import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// PENTING: jangan `throw` di sini. Kode di file ini berjalan saat modul
// pertama kali di-import (yaitu sebelum React sempat render apapun), jadi
// kalau di-throw, seluruh app gagal mount dan browser cuma menampilkan
// layar putih kosong tanpa pesan error yang terlihat (errornya cuma ada
// di console browser). Sebagai gantinya kita simpan pesan error dan
// lempar itu belakangan, saat benar-benar dipakai untuk fetch data —
// di titik itu errornya sudah tertangkap oleh try/catch di
// `useSalesData.tsx` dan ditampilkan rapi lewat <ErrorState />.
export const supabaseConfigError =
  !url || !anonKey
    ? 'VITE_SUPABASE_URL dan/atau VITE_SUPABASE_ANON_KEY belum terbaca. ' +
      'Pastikan file .env ada di root project (sejajar dengan package.json), ' +
      'isinya sesuai .env.example, lalu restart "npm run dev" (env baru hanya ' +
      'terbaca saat dev server pertama kali start).'
    : null;

export const supabase = createClient(
  url ?? 'https://placeholder.invalid',
  anonKey ?? 'placeholder-anon-key'
);