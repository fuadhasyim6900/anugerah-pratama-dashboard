import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diset. ' +
      'Buat file .env (lihat .env.example) dan/atau set Environment Variables di Vercel.'
  );
}

export const supabase = createClient(url, anonKey);