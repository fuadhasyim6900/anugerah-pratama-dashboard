# Dashboard Kinerja Penjualan & Active Outlet (AO) — CV Anugerah Pratama

Dashboard penjualan & Active Outlet (AO) untuk seluruh depo CV Anugerah Pratama, dibangun dengan React + Vite + TypeScript + Tailwind, siap di-deploy ke Vercel.

## Halaman

1. **Executive Dashboard** — total omset, target, total AO, rata-rata omset/AO, persentase pencapaian, target vs realisasi, tren bulanan, omset per kota & per depo.
2. **Kinerja DSR** — peringkat penjualan DSR, rata-rata AO per DSR, breakdown per supplier untuk DSR terpilih (termasuk kontribusi omset telemarketing).
3. **Proyeksi S2 2026** — skenario proyeksi Juli–Desember (tren historis, flat, target +5%/+10%, atau kustom -20% s/d +20%).
4. **Review Kinerja DSR & Solusi Strategis** — analisis kelemahan & rekomendasi per DSR, dihitung otomatis dari data (bukan teks statis), sehingga selalu mengikuti data terbaru.

Sidebar berisi filter **Depo**, **Bulan**, dan **Tahun** yang berlaku ke semua halaman. Ada juga tombol ganti tema gelap/terang, ekspor halaman aktif ke PDF, dan ekspor laporan lengkap (4 halaman sekaligus) ke PDF.

## Sumber data

Data **tidak** di-hardcode dan **tidak** dibaca langsung dari file Excel oleh dashboard saat halaman dibuka. Alurnya:

```
public/data/DATA.xlsx               → transaksi penjualan (NOMINAL, SUPP, DEPO, BULAN, TAHUN, KD GRUP, SALES, KOTA, TELE)
public/data/DATA_TARGET_FUAD.xlsx   → target bulanan per salesman/supplier
public/data/REALISASI UANG MASUK.xlsx → target & realisasi penagihan piutang
```

File-file Excel di atas hanyalah **sumber lokal** yang dibaca oleh `scripts/sync-data.mjs` (jalan di komputer Anda, bukan di browser) lalu disinkronkan ke Supabase. Dashboard sendiri mengambil datanya dari Supabase lewat `/api/data` & `/api/meta` (lihat bagian "Cara data diambil" di bawah) — **bukan** dari file Excel di repo secara langsung.

> Catatan teknis: kedua file sumber ternyata menyimpan nama kolom dengan tanda kutip & spasi tambahan (mis. `" DEPO "` bukan `DEPO`) — kemungkinan sisa dari proses export CSV→Excel. Parser di `sync-data.mjs` sudah menormalkan ini secara otomatis.

### Cara update data setiap hari

1. Timpa (replace) file Excel yang relevan di `public/data/` di komputer Anda dengan versi terbaru — **nama file harus tetap sama persis**.
2. Jalankan:
   ```bash
   node --env-file=.env scripts/sync-data.mjs
   ```
3. Selesai — data langsung masuk ke Supabase, dan **dashboard otomatis mengikuti dalam ≤60 detik** (lihat bagian "Cara data diambil" di bawah untuk penjelasan mekanismenya). Tidak perlu commit/push file Excel ke GitHub, dan tidak perlu klik Refresh secara manual (meski tombol Refresh tetap ada kalau Anda ingin memastikan).

> Catatan: kolom `TAHUN` pada file omset saat ini belum ada (data yang diupload baru berisi 2026). Begitu Anda menambahkan kolom `TAHUN` beserta data 2025, filter Tahun dan perbandingan YoY di halaman Proyeksi S2 akan otomatis terisi tanpa perlu ubah kode apa pun — kalau kolom `TAHUN` kosong, baris otomatis dianggap tahun 2026.

## Menampilkan waktu terakhir update data

Dashboard menampilkan **"Data terakhir diupdate: ..."** di kanan atas — ini adalah waktu Anda terakhir menjalankan `node scripts/sync-data.mjs` (bukan waktu browser memuat halaman, yang ditampilkan terpisah sebagai "Dimuat di browser").

Sekali saja, buat tabel kecil ini di Supabase (**SQL Editor** → jalankan query berikut):

```sql
create table if not exists data_meta (
  id int primary key,
  synced_at timestamptz not null default now()
);

alter table data_meta enable row level security;

create policy "Allow public read" on data_meta
  for select using (true);
```

Setelah itu, setiap kali Anda menjalankan `node scripts/sync-data.mjs`, waktu sync otomatis tercatat ke tabel ini dan langsung muncul di dashboard setelah Anda klik **Refresh**. Tidak perlu setup tambahan apa pun — kalau tabel ini belum dibuat, dashboard tetap jalan normal, hanya saja baris "Data terakhir diupdate" belum muncul.

## Realisasi Uang Masuk

Halaman **Realisasi Uang Masuk** menampilkan target & realisasi penagihan piutang per depo per bulan, dari file `REALISASI UANG MASUK.xlsx` (kolom `TAHUN`, `BULAN`, `DEPO`, `TARGET PIUTANG`, `REALISASI PIUTANG`), disinkronkan ke tabel `uang_masuk` di Supabase — pola yang sama seperti tabel `sales` & `targets`.

Karena tabel ini **belum ada** di Supabase Anda, buat dulu (sekali saja) lewat **SQL Editor**:

```sql
create table if not exists uang_masuk (
  id bigint generated always as identity primary key,
  tahun int not null,
  bulan text not null,
  depo text not null,
  target_piutang numeric not null default 0,
  realisasi_piutang numeric not null default 0
);

create index if not exists uang_masuk_tahun_idx on uang_masuk (tahun);
create index if not exists uang_masuk_depo_idx on uang_masuk (depo);

alter table uang_masuk enable row level security;

create policy "Allow public read" on uang_masuk
  for select using (true);
```

(Query yang sama juga tersedia di file `supabase_uang_masuk.sql` di root proyek ini.)

Setelah tabel dibuat, letakkan `REALISASI UANG MASUK.xlsx` di `public/data/` (nama file harus persis sama) lalu jalankan:

```bash
node scripts/sync-data.mjs
```

Script ini sekarang juga menyinkronkan `uang_masuk` sekaligus dengan `sales` & `targets`. Kalau tabelnya belum dibuat, sinkronisasi data ini akan gagal dengan pesan yang jelas tapi **tidak** menggagalkan sinkronisasi `sales`/`targets`. Di dashboard sendiri, sebelum tabelnya dibuat, halaman Realisasi Uang Masuk akan menampilkan pesan "Data belum tersedia" alih-alih error — halaman lain tetap berjalan normal.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka http://localhost:5173

## Build production

```bash
npm run build
npm run preview   # untuk mengetes hasil build secara lokal
```

## Deploy ke Vercel

1. Push project ini ke repository GitHub Anda.
2. Di Vercel: **New Project** → import repo tersebut.
3. Framework preset: **Vite** (Vercel akan mendeteksinya otomatis).
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Di **Settings → Environment Variables**, tambahkan dua variable ini (nilainya sama dengan yang ada di `.env` lokal Anda):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Deploy. Setelah itu, setiap `git push` ke branch utama akan otomatis membuat deployment baru.

## Cara data diambil (dan kenapa lewat /api/data + /api/meta, bukan langsung dari browser)

Data disimpan di Supabase (tabel `sales`, `targets`, `uang_masuk`), diisi lewat `node scripts/sync-data.mjs`. Tabel `sales` sendiri berisi ± 262.000 baris.

Browser **tidak** memanggil Supabase secara langsung. Alurnya dua tahap:

1. Browser memanggil `/api/meta` (`api/meta.js`) — endpoint kecil & murah yang cuma mengembalikan `syncedAt` (waktu sync terakhir). Di-cache Vercel **60 detik saja**.
2. Browser lalu memanggil `/api/data?v=<syncedAt>` (`api/data.js`) — endpoint yang mengambil seluruh data dari Supabase. Karena URL-nya menyertakan versi (`v`), Vercel meng-cache-nya **sangat lama per versi** (data untuk versi yang sama memang tidak pernah berubah).

**Kenapa dua tahap, bukan satu cache biasa:** dengan cara ini, begitu Anda menjalankan `sync-data.mjs`, `syncedAt` di Supabase berubah → dalam waktu **maksimal 60 detik**, semua browser sales otomatis mendeteksi versi baru lewat `/api/meta` → mereka memanggil `/api/data?v=<versi-baru>`, yang otomatis dianggap cache MISS oleh Vercel (karena URL-nya beda) sehingga Supabase diakses ulang **sekali** untuk versi itu, lalu hasilnya dilayani dari cache untuk semua sales lain yang membuka dashboard di versi yang sama.

Hasilnya: **dashboard otomatis ter-update dalam hitungan detik/menit setelah sync**, sales tidak perlu klik Refresh, DAN Supabase tetap hanya diakses satu kali per sync (bukan sekali per kunjungan per sales) — jadi kuota egress Supabase Free (5 GB/bulan) tetap aman meski trafik ramai.

> Catatan: mekanisme ini mensyaratkan tabel `data_meta` sudah dibuat (lihat bagian "Menampilkan waktu terakhir update data" di atas) dan terisi lewat `sync-data.mjs`. Kalau tabel itu belum ada, `/api/meta` akan mengembalikan versi kosong dan `/api/data` otomatis jatuh ke cache fallback pendek (5 menit) — dashboard tetap jalan normal, hanya saja deteksi sync-nya tidak seinstan itu.

## Struktur proyek

```
src/
  lib/            → parsing Excel (SheetJS), agregasi data, mesin analisis DSR, ekspor PDF
  store/          → filter global (Depo/Bulan/Tahun) & tema (Zustand)
  hooks/          → provider data (fetch & parse sekali, dipakai semua halaman)
  components/     → Sidebar, TopBar, KPI card, chart wrapper (Recharts)
  pages/          → 4 halaman dashboard
public/
  data/           → 2 file Excel sumber data (timpa file ini untuk update harian)
  Logo-AP_PNG.webp
```

## Font

Menggunakan **Plus Jakarta Sans** (sama seperti referensi), dimuat lewat Google Fonts di `src/index.css`.

## Ekspor / Cetak

- **Ekspor Halaman Aktif** — merender halaman yang sedang dibuka menjadi PDF (via `html2canvas` + `jsPDF`) lalu otomatis mengunduhnya. File PDF yang terunduh bisa langsung dicetak dari PDF viewer manapun.
- **Ekspor Laporan Lengkap** — otomatis berpindah ke keempat halaman satu per satu, menangkap tiap halaman, lalu menggabungkannya menjadi satu file PDF multi-halaman.

