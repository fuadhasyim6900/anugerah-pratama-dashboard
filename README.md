# Dashboard Kinerja Penjualan & Active Outlet (AO) — CV Anugerah Pratama

Dashboard penjualan & Active Outlet (AO) untuk seluruh depo CV Anugerah Pratama, dibangun dengan React + Vite + TypeScript + Tailwind, siap di-deploy ke Vercel.

## Halaman

1. **Executive Dashboard** — total omset, target, total AO, rata-rata omset/AO, persentase pencapaian, target vs realisasi, tren bulanan, omset per kota & per depo.
2. **Kinerja DSR** — peringkat penjualan DSR, rata-rata AO per DSR, breakdown per supplier untuk DSR terpilih (termasuk kontribusi omset telemarketing).
3. **Proyeksi S2 2026** — skenario proyeksi Juli–Desember (tren historis, flat, target +5%/+10%, atau kustom -20% s/d +20%).
4. **Review Kinerja DSR & Solusi Strategis** — analisis kelemahan & rekomendasi per DSR, dihitung otomatis dari data (bukan teks statis), sehingga selalu mengikuti data terbaru.

Sidebar berisi filter **Depo**, **Bulan**, dan **Tahun** yang berlaku ke semua halaman. Ada juga tombol ganti tema gelap/terang, ekspor halaman aktif ke PDF, dan ekspor laporan lengkap (4 halaman sekaligus) ke PDF.

## Sumber data

Data **tidak** di-hardcode — dashboard membaca langsung 2 file Excel ini saat halaman dibuka:

```
public/data/DATA.xlsx               → transaksi penjualan (NOMINAL, SUPP, DEPO, BULAN, TAHUN, KD GRUP, SALES, KOTA, TELE)
public/data/DATA_TARGET_FUAD.xlsx   → target bulanan per salesman/supplier
```

> Catatan teknis: kedua file sumber ternyata menyimpan nama kolom dengan tanda kutip & spasi tambahan (mis. `" DEPO "` bukan `DEPO`) — kemungkinan sisa dari proses export CSV→Excel. Parser sudah menormalkan ini secara otomatis, jadi tidak masalah walau formatnya seperti itu tetap terbaca dengan benar (ini juga penyebab kartu Target sebelumnya tidak terbaca — sudah diperbaiki).

### Cara update data setiap hari

1. Buka repository GitHub Anda.
2. Timpa (replace) kedua file di atas dengan versi terbaru — **nama file harus tetap sama persis**.
3. Commit & push ke branch yang terhubung ke Vercel.
4. Vercel otomatis build & deploy ulang (biasanya 1–2 menit). Setelah deploy selesai, buka dashboard dan klik tombol **Refresh** di kanan atas untuk memastikan data terbaru terambil (dashboard juga selalu fetch file dengan cache-busting, jadi tidak akan menampilkan data lama yang ter-cache browser).

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

## Cara data diambil (dan kenapa lewat /api/data, bukan langsung dari browser)

Data disimpan di Supabase (tabel `sales`, `targets`, `uang_masuk`), diisi lewat `node scripts/sync-data.mjs`. Tabel `sales` sendiri berisi ± 262.000 baris.

Browser **tidak** memanggil Supabase secara langsung. Sebagai gantinya, browser memanggil `/api/data` — sebuah Vercel Serverless Function (`api/data.js`) yang mengambil data dari Supabase di sisi server, lalu Vercel meng-cache hasilnya (default 4 jam, atur lewat `CACHE_SECONDS` di `api/data.js`).

Alasannya: kalau 262.000 baris itu ditarik ulang dari Supabase oleh **setiap** browser sales di **setiap** kunjungan, kuota egress Supabase Free (5 GB/bulan) akan habis hanya dengan traffic ringan. Dengan cache di `/api/data`, berapa pun banyaknya sales yang membuka dashboard dalam jendela cache tsb, Supabase hanya diakses satu kali — sisanya dilayani dari cache Vercel.

**Konsekuensinya:** data di dashboard bisa telat sampai dengan durasi cache (default 4 jam) dibanding waktu Anda menjalankan `sync-data.mjs`. Kalau Anda sync di jam-jam tetap (misal 3x sehari), sesuaikan `CACHE_SECONDS` di `api/data.js` supaya jendelanya pas dengan jarak antar sync Anda.

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

